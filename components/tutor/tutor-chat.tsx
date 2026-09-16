"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Loader2,
  Brain,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { TutorMarkdown } from "./tutor-markdown";

interface Message {
  id: string;
  role: string;
  content: string;
  sources: unknown;
  evidence_state: string | null;
  created_at: string;
}

interface Citation {
  materialId: string;
  fileName: string;
  pageNumber: number | null;
  excerpt: string;
}

interface TutorChatProps {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string | null;
  conversationId: string | null;
  initialMessages: Message[];
  userId: string;
}

const evidenceConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  SUPPORTED: { icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Supported by material" },
  PARTIALLY_SUPPORTED: { icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Partially supported" },
  INSUFFICIENT_EVIDENCE: { icon: HelpCircle, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", label: "Insufficient evidence" },
};

export function TutorChat({
  projects,
  activeProjectId,
  conversationId,
  initialMessages,
  userId,
}: TutorChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<
    Array<{
      role: string;
      content: string;
      evidenceState?: string | null;
      citations?: Citation[];
    }>
  >(
    initialMessages.map((m) => ({
      role: m.role,
      content: m.content,
      evidenceState: m.evidence_state,
      citations: m.sources as Citation[] | undefined,
    }))
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeProjectId || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.error || "Something went wrong"}` },
        ]);
        return;
      }

      // SSE streaming
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let finalEvidenceState: string | null = null;
      let finalCitations: Citation[] = [];

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
              if (data.done) {
                finalEvidenceState = data.evidenceState;
                finalCitations = data.citations ?? [];
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      // Update final message with evidence state and citations
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: assistantContent,
          evidenceState: finalEvidenceState,
          citations: finalCitations,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to connect to the tutor. Please try again." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, activeProjectId, conversationId, isStreaming]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800/60 bg-slate-900/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20">
            <Brain className="h-5 w-5 text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold text-white">AI Tutor</h1>
        </div>

        <Select
          value={activeProjectId ?? ""}
          onValueChange={(v) => {
            if (v) router.push(`/tutor?project=${v}`);
          }}
        >
          <SelectTrigger className="w-64 bg-slate-800/50 border-slate-700 text-slate-300">
            <SelectValue placeholder="Select a project">
              {(val: string | null) => {
                const targetId = val || activeProjectId;
                if (!targetId) return "Select a project";
                const match = projects.find((p) => p.id === targetId);
                return match?.name ?? "Select a project";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!activeProjectId ? (
          <div className="flex items-center justify-center h-full">
            <Card className="bg-slate-900/50 border-slate-800/60 max-w-md">
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-indigo-400/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Select a project
                </h3>
                <p className="text-slate-400 text-sm">
                  Choose a project to start chatting with your AI tutor about your study materials.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="bg-slate-900/50 border-slate-800/60 max-w-md">
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-indigo-400/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Ask me anything
                </h3>
                <p className="text-slate-400 text-sm">
                  I&apos;ll answer using your study materials as evidence. Every response is grounded in what you&apos;ve uploaded.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="h-4 w-4 text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[75%] space-y-2 ${
                  msg.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-slate-800/60 text-slate-200 rounded-bl-md border border-slate-700/50"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <TutorMarkdown content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                  {isStreaming &&
                    i === messages.length - 1 &&
                    msg.role === "assistant" &&
                    !msg.content && (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    )}
                </div>

                {/* Evidence badge */}
                {msg.evidenceState && msg.role === "assistant" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const cfg =
                        evidenceConfig[msg.evidenceState] ??
                        evidenceConfig.INSUFFICIENT_EVIDENCE;
                      const Icon = cfg.icon;
                      return (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${cfg.color} border`}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>
                )}

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {msg.citations.map((c, ci) => (
                      <Badge
                        key={ci}
                        variant="outline"
                        className="text-[10px] bg-slate-800/50 text-slate-400 border-slate-700"
                      >
                        <FileText className="h-2.5 w-2.5 mr-1" />
                        {c.fileName}
                        {c.pageNumber ? ` p.${c.pageNumber}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {activeProjectId && (
        <div className="px-6 py-4 border-t border-slate-800/60 bg-slate-900/30">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about your study materials…"
              rows={1}
              className="bg-slate-800/50 border-slate-700 text-white resize-none min-h-[44px] max-h-[200px]"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-[44px] px-4"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
