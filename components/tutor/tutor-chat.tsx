"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
  Sparkles,
  ClipboardCheck,
  BookOpen,
  ArrowRight,
  RefreshCw,
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
  fileType?: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  materials?: Array<{ id: string; status: string; file_name: string }>;
}

interface TutorChatProps {
  projects: ProjectOption[];
  activeProjectId: string | null;
  conversationId: string | null;
  initialMessages: Message[];
  initialOpeningGreeting?: string | null;
  userId: string;
}

const evidenceConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  SUPPORTED: {
    icon: CheckCircle,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    label: "Grounded in Material",
  },
  PARTIALLY_SUPPORTED: {
    icon: AlertTriangle,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    label: "Partially Supported",
  },
  INSUFFICIENT_EVIDENCE: {
    icon: HelpCircle,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    label: "Insufficient Evidence",
  },
};

const STARTER_PROMPTS = [
  "What are the main topics and concepts in this material?",
  "Explain the most challenging concept simply with an example.",
  "What are common pitfalls or mistakes to avoid in this subject?",
  "Summarize the key definitions and formulas.",
];

export function TutorChat({
  projects,
  activeProjectId,
  conversationId,
  initialMessages,
  initialOpeningGreeting,
}: TutorChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<
    Array<{
      role: string;
      content: string;
      evidenceState?: string | null;
      citations?: Citation[];
    }>
  >(() => {
    if (initialMessages.length > 0) {
      return initialMessages.map((m) => ({
        role: m.role,
        content: m.content,
        evidenceState: m.evidence_state,
        citations: m.sources as Citation[] | undefined,
      }));
    }
    if (initialOpeningGreeting) {
      return [
        {
          role: "assistant",
          content: initialOpeningGreeting,
          evidenceState: "SUPPORTED",
          citations: [],
        },
      ];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(
        initialMessages.map((m) => ({
          role: m.role,
          content: m.content,
          evidenceState: m.evidence_state,
          citations: m.sources as Citation[] | undefined,
        }))
      );
    } else if (initialOpeningGreeting) {
      setMessages([
        {
          role: "assistant",
          content: initialOpeningGreeting,
          evidenceState: "SUPPORTED",
          citations: [],
        },
      ]);
    } else {
      setMessages([]);
    }
  }, [initialMessages, initialOpeningGreeting]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const readyDocsCount =
    activeProject?.materials?.filter((m) => m.status === "ready").length ?? 0;

  const sendMessage = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || !activeProjectId || isStreaming) return;

      const userMessage = textToSend.trim();
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
          const err = await res
            .json()
            .catch(() => ({ error: "Request failed" }));
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Could not complete response: ${
                err.error || "Please try again shortly."
              }`,
            },
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
                // ignore parse errors on incomplete chunk
              }
            }
          }
        }

        // Update final message with citations and evidence
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
      } catch (err) {
        console.error("Tutor stream error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Unable to connect to the AI Tutor service. Please check your connection and try again.",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [activeProjectId, conversationId, isStreaming]
  );

  const handleSend = () => sendMessage(input);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Tutor Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 shrink-0">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <Breadcrumbs
              items={
                activeProject
                  ? [
                      { label: "Spaces & Projects", href: "/projects" },
                      { label: activeProject.name, href: `/projects/${activeProject.id}` },
                      { label: "AI Tutor" },
                    ]
                  : [
                      { label: "Dashboard", href: "/dashboard" },
                      { label: "AI Tutor" },
                    ]
              }
              className="mb-1"
            />
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                AI Study Tutor
              </h1>
              <Badge
                variant="outline"
                className="bg-indigo-500/10 text-indigo-300 border-indigo-500/25 text-[10px] hidden sm:inline-flex"
              >
                Document-Grounded
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              {activeProject
                ? readyDocsCount > 0
                  ? `${readyDocsCount} document${readyDocsCount > 1 ? "s" : ""} indexed & cited`
                  : "Upload a PDF material in this project for grounded retrieval"
                : "Select a project to start learning"}
            </p>
          </div>
        </div>

        {/* Project Selector - Strictly preserves project name rendering */}
        <div className="flex items-center gap-2">
          <Select
            value={activeProjectId ?? ""}
            onValueChange={(v) => {
              if (v) router.push(`/tutor?project=${v}`);
            }}
          >
            <SelectTrigger className="w-52 sm:w-64 bg-slate-800/60 border-slate-700 text-slate-200 text-xs h-9">
              <SelectValue placeholder="Select study project">
                {(val: string | null) => {
                  const targetId = val || activeProjectId;
                  if (!targetId) return "Select study project";
                  const match = projects.find((p) => p.id === targetId);
                  return match?.name ?? "Select study project";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {!activeProjectId ? (
          <div className="flex items-center justify-center h-full">
            <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm max-w-md text-center p-6">
              <CardContent className="space-y-3 p-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  Select a Study Project
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Choose an active study project from the selector above. The AI Tutor will retrieve and cite exact excerpts from that project&apos;s materials.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70%] max-w-xl mx-auto text-center space-y-5 py-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-white tracking-tight">
                {activeProject?.name} Tutor Workspace
              </h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Ask any question about this project&apos;s materials. The AI will strictly cite evidence from your uploaded documents and notify you if evidence is insufficient.
              </p>
            </div>

            {/* Suggested Prompts Grid */}
            <div className="w-full space-y-2 pt-2 text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Suggested study questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(prompt)}
                    disabled={isStreaming}
                    className="p-3 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-800/80 hover:border-indigo-500/40 text-left text-xs text-slate-300 transition-colors flex items-start gap-2 group"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="group-hover:text-white transition-colors">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isInsufficient = msg.evidenceState === "INSUFFICIENT_EVIDENCE";

            return (
              <div
                key={i}
                className={`flex gap-3 max-w-4xl mx-auto ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
                    <Brain className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${
                    isUser ? "text-right" : ""
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-sm shadow-sm"
                        : "bg-slate-900/90 text-slate-200 rounded-bl-sm border border-slate-800/80 shadow-sm"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <>
                        {msg.content ? (
                          <TutorMarkdown content={msg.content} />
                        ) : isStreaming && i === messages.length - 1 ? (
                          <div className="flex items-center gap-2 text-indigo-300 text-xs py-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Synthesizing grounded evidence…</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {/* Insufficient Evidence Notice */}
                  {!isUser && isInsufficient && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 flex items-start gap-2.5">
                      <HelpCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-rose-300">
                          Insufficient Evidence in Uploaded Material
                        </p>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          This information is not available in your study material. To ensure strict academic integrity, general unverified knowledge is not substituted.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Evidence State Badge */}
                  {!isUser && msg.evidenceState && !isInsufficient && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {(() => {
                        const cfg =
                          evidenceConfig[msg.evidenceState] ??
                          evidenceConfig.SUPPORTED;
                        const Icon = cfg.icon;
                        return (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${cfg.color} border py-0.5`}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                    </div>
                  )}

                  {/* Academic Citations Badges */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
                        Sources:
                      </span>
                      {msg.citations.map((c, ci) => {
                        const lower = (c.fileName || "").toLowerCase();
                        const fileType = c.fileType || "";
                        const isPptx =
                          fileType.includes("presentation") ||
                          lower.endsWith(".pptx");
                        const isPdf =
                          fileType.includes("pdf") ||
                          lower.endsWith(".pdf");

                        let pageOrSourceTag: string;
                        if (isPptx && c.pageNumber != null) {
                          pageOrSourceTag = `[slide ${c.pageNumber}]`;
                        } else if (isPdf && c.pageNumber != null) {
                          pageOrSourceTag = `[p. ${c.pageNumber}]`;
                        } else {
                          pageOrSourceTag = `[Source ${ci + 1}]`;
                        }

                        return (
                          <Badge
                            key={ci}
                            variant="outline"
                            className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 text-[10px] py-0.5"
                            title={c.excerpt ? `Excerpt: "${c.excerpt.slice(0, 100)}..."` : undefined}
                          >
                            <FileText className="h-2.5 w-2.5 mr-1 text-indigo-400" />
                            <span className="font-semibold text-slate-200 mr-1">
                              {pageOrSourceTag}
                            </span>
                            <span className="text-slate-300 font-medium truncate max-w-[160px]">
                              {c.fileName}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Phase 19: High-Value CTA: Practice this concept in Quiz */}
                  {!isUser && msg.content && activeProjectId && (
                    <div className="pt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Understood this explanation?</span>
                      <Link
                        href={`/quiz?project=${activeProjectId}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <ClipboardCheck className="h-3 w-3 text-emerald-400" />
                        Practice in Quiz &rarr;
                      </Link>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {activeProjectId && (
        <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md shrink-0">
          <div className="flex items-end gap-2.5 max-w-4xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question grounded in your study documents… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="bg-slate-800/60 border-slate-700 text-white text-xs sm:text-sm placeholder:text-slate-500 resize-none min-h-[44px] max-h-[160px] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-[44px] px-4 rounded-xl shrink-0 shadow-sm transition-colors"
              aria-label="Send study query"
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
