"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  FileText,
  Upload,
  Lightbulb,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  FileCheck2,
  Layers,
  ChevronRight,
  BarChart3,
} from "lucide-react";

interface Material {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  page_count: number | null;
  error_message: string | null;
  created_at: string;
}

interface Concept {
  id: string;
  name: string;
  description: string | null;
}

interface MasteryData {
  concept_id: string;
  mastery_score: number;
  trend: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  learning_goal: string | null;
  space_id: string;
}

interface ProjectDetailContentProps {
  project: Project;
  materials: Material[];
  concepts: Concept[];
  mastery: MasteryData[];
  userId: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ProjectDetailContent({
  project,
  materials,
  concepts,
  mastery,
}: ProjectDetailContentProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const masteryMap = new Map(mastery.map((m) => [m.concept_id, m]));
  const avgMastery =
    mastery.length > 0
      ? Math.round(
          mastery.reduce((sum, m) => sum + m.mastery_score, 0) / mastery.length
        )
      : 0;

  // Auto-refresh when materials are queued or processing
  useEffect(() => {
    const hasPending = materials.some(
      (m) => m.status === "queued" || m.status === "processing"
    );
    if (!hasPending) return;

    const timer = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(timer);
  }, [materials, router]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const lowerName = file.name.toLowerCase();
      const isAllowed =
        file.type === "application/pdf" ||
        file.type === "text/plain" ||
        file.type === "text/markdown" ||
        file.type === "text/x-markdown" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        file.type === "application/docx" ||
        file.type === "application/pptx" ||
        lowerName.endsWith(".pdf") ||
        lowerName.endsWith(".docx") ||
        lowerName.endsWith(".pptx") ||
        lowerName.endsWith(".txt") ||
        lowerName.endsWith(".md") ||
        lowerName.endsWith(".markdown");

      if (!isAllowed) {
        setUploadError("Only PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt) files are supported.");
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/projects/${project.id}/materials`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: `Upload failed (HTTP ${res.status})` }));
          setUploadError(err.error || "Material upload failed. Please try again.");
          return;
        }

        router.refresh();
      } catch (err) {
        console.error("Upload error:", err);
        setUploadError(
          err instanceof Error
            ? err.message
            : "Network error during upload. Please check your connection."
        );
      } finally {
        setUploading(false);
      }
    },
    [project.id, router]
  );

  const readyMaterials = materials.filter((m) => m.status === "ready");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Spaces & Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      {/* Header with Navigation & CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {project.name}
            </h1>
          </div>
            {project.description && (
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {project.description}
              </p>
            )}
            {project.learning_goal && (
              <p className="text-xs text-indigo-300 font-medium mt-1.5 flex items-center gap-1.5">
                <span>🎯 Goal:</span> {project.learning_goal}
              </p>
            )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/projects/${project.id}/analytics`}>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs h-9 px-3.5"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              Analytics
            </Button>
          </Link>
          <Link href={`/tutor?project=${project.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs h-9 px-3.5"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
              AI Tutor
            </Button>
          </Link>
          <Link href={`/quiz?project=${project.id}`}>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 shadow-sm"
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              Quiz Me
            </Button>
          </Link>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <AlertDescription>{uploadError}</AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUploadError(null)}
            className="h-6 px-2 text-rose-400 hover:text-rose-200 text-xs"
          >
            Dismiss
          </Button>
        </Alert>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">
                {readyMaterials.length}
                <span className="text-xs text-slate-400 font-normal ml-1">
                  /{materials.length}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">Materials Ready</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{concepts.length}</p>
              <p className="text-[11px] text-slate-400">Concepts Extracted</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">
                {mastery.length > 0 ? `${avgMastery}%` : "—"}
              </p>
              <p className="text-[11px] text-slate-400">Avg. Mastery</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">
                {materials.reduce((sum, m) => sum + (m.page_count ?? 0), 0)}
              </p>
              <p className="text-[11px] text-slate-400">Pages Indexed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Layout: Materials & Concepts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Materials List & Upload Zone */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              Study Materials ({materials.length})
            </h2>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleUpload(file);
            }}
            className={`border border-dashed rounded-xl p-6 sm:p-8 text-center transition-colors ${
              dragActive
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mb-1">
              Drag & drop lecture notes, PDFs, or Markdown here, or{" "}
              <label className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer font-semibold">
                browse files
                <input
                  type="file"
                  accept="application/pdf,.pdf,text/plain,.txt,text/markdown,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
            </p>
            <p className="text-[11px] text-slate-400">
              Supports PDF, Word (.docx), PowerPoint (.pptx), Markdown, and text files up to 50MB • Structured chunks & concepts indexed
            </p>
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 py-2 px-4 rounded-lg max-w-xs mx-auto text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading and queuing document…</span>
              </div>
            )}
          </div>

          {/* Materials Cards List */}
          {materials.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800/80 bg-slate-900/30 text-center text-xs text-slate-400">
              No materials uploaded yet. Add a PDF above to extract knowledge concepts.
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat) => {
                const isReady = mat.status === "ready";
                const isProcessing = mat.status === "processing";
                const isQueued = mat.status === "queued";
                const isFailed = mat.status === "failed";

                return (
                  <Card
                    key={mat.id}
                    className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-indigo-400 shrink-0 mt-0.5">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {mat.file_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {mat.page_count && (
                                <span>{mat.page_count} pages</span>
                              )}
                              <span>•</span>
                              <span>Added {formatRelativeTime(mat.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isReady && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                              Ready
                            </Badge>
                          )}
                          {isProcessing && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]"
                            >
                              <Loader2 className="h-3 w-3 mr-1 animate-spin text-amber-400" />
                              Processing
                            </Badge>
                          )}
                          {isQueued && (
                            <Badge
                              variant="outline"
                              className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Queued
                            </Badge>
                          )}
                          {isFailed && (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px]"
                            >
                              <XCircle className="h-3 w-3 mr-1 text-rose-400" />
                              Failed
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Processing Progressive Experience */}
                      {isProcessing && (
                        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 text-xs space-y-1.5">
                          <p className="text-slate-300 font-medium text-[11px] mb-2">
                            Background Knowledge Ingestion:
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>Upload complete</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>Extracting content</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              <span>Building representations</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span className="w-2.5 h-2.5 rounded-full border border-slate-600 shrink-0 ml-0.5" />
                              <span>Indexing concepts</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Failure Explanation */}
                      {isFailed && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                          <p className="font-semibold">Processing could not be completed:</p>
                          <p className="text-[11px] text-rose-300/80">
                            {mat.error_message || "The file structure could not be parsed. Ensure the PDF contains readable text."}
                          </p>
                        </div>
                      )}

                      {/* Material Actions */}
                      {isReady && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/40">
                          <Link href={`/quiz?project=${project.id}&material=${mat.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5"
                            >
                              <ClipboardCheck className="h-3 w-3 mr-1" />
                              Quiz this doc
                            </Button>
                          </Link>
                          <Link href={`/tutor?project=${project.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2.5"
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Ask Tutor
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Extracted Concepts Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              Concepts ({concepts.length})
            </h2>
          </div>

          {concepts.length === 0 ? (
            <Card className="border-slate-800/80 bg-slate-900/40 p-6 text-center">
              <Lightbulb className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-300">
                No concepts extracted yet
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload and process a PDF material to automatically extract and track concept mastery.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {concepts.map((concept) => {
                const cm = masteryMap.get(concept.id);
                const score = cm?.mastery_score ?? 0;
                const trend = cm?.trend;

                return (
                  <Card
                    key={concept.id}
                    className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {concept.name}
                      </h4>
                      <span className="text-[11px] font-bold text-slate-300 shrink-0">
                        {score > 0 ? `${score.toFixed(0)}%` : "Unrated"}
                      </span>
                    </div>

                    <Progress
                      value={score}
                      className="h-1 bg-slate-800"
                    />

                    {concept.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {concept.description}
                      </p>
                    )}

                    {trend && (
                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                        <span>Trend: {trend.replace(/_/g, " ")}</span>
                        <Link
                          href={`/quiz?project=${project.id}`}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Practice &rarr;
                        </Link>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
