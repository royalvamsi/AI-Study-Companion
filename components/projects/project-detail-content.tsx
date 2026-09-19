"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  resolveCanonicalFileType,
  MAX_MATERIAL_FILE_SIZE,
} from "@/lib/materials/validation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  FileText,
  Upload,
  Lightbulb,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileCheck2,
  BarChart3,
  ArrowRight,
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
      const resolvedFileType = resolveCanonicalFileType(file.name, file.type);

      if (!resolvedFileType) {
        setUploadError(
          "Only PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt) files are supported."
        );
        return;
      }

      if (file.size > MAX_MATERIAL_FILE_SIZE) {
        setUploadError("File too large. Maximum size is 50MB.");
        return;
      }

      setUploading(true);
      let targetFilePath: string | null = null;
      const supabase = createClient();

      try {
        // Step 1: Initialize upload and get signed upload target
        const initRes = await fetch(
          `/api/projects/${project.id}/materials/upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileType: resolvedFileType,
              fileSize: file.size,
            }),
          }
        );

        if (!initRes.ok) {
          const err = await initRes
            .json()
            .catch(() => ({ error: `Upload initialization failed (${initRes.status})` }));
          setUploadError(err.error || "Upload initialization failed. Please try again.");
          return;
        }

        const { materialId, filePath, token, path } = await initRes.json();
        targetFilePath = filePath;

        // Step 2: Direct browser-to-storage upload (bypassing Vercel Function payload limits)
        let storageError = null;

        if (token && path) {
          const { error } = await supabase.storage
            .from("materials")
            .uploadToSignedUrl(path, token, file, {
              contentType: resolvedFileType,
            });
          storageError = error;
        } else {
          // Fallback to authenticated direct upload if signed token was not returned
          const { error } = await supabase.storage
            .from("materials")
            .upload(filePath, file, {
              contentType: resolvedFileType,
              upsert: false,
            });
          storageError = error;
        }

        if (storageError) {
          setUploadError(`Storage upload failed: ${storageError.message}`);
          return;
        }

        // Step 3: Finalize metadata (small JSON payload)
        const finalizeRes = await fetch(
          `/api/projects/${project.id}/materials/finalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId,
              fileName: file.name,
              filePath,
              fileType: resolvedFileType,
              fileSize: file.size,
            }),
          }
        );

        if (!finalizeRes.ok) {
          const err = await finalizeRes
            .json()
            .catch(() => ({ error: `Finalize failed (${finalizeRes.status})` }));
          setUploadError(err.error || "Material finalization failed. Please try again.");

          // If finalize failed with a 4xx validation error (before DB insert), request safe server-side cleanup.
          // The server-side contract guarantees the object will never be deleted if any material record references it.
          if (finalizeRes.status >= 400 && finalizeRes.status < 500 && targetFilePath) {
            try {
              await fetch(`/api/projects/${project.id}/materials/finalize`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ materialId, filePath: targetFilePath }),
              });
            } catch (cleanupErr) {
              console.warn("Server safe-cleanup request error:", cleanupErr);
            }
          }
          return;
        }

        router.refresh();
      } catch (err) {
        console.error("Upload error:", err);
        // Do NOT blindly delete the Storage object from the browser after finalize failures
        // because DB insertion may already have succeeded while the network response was lost.
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
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Spaces & Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      {/* Header with Navigation & CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b hairline">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
              Project Workspace
            </span>
          </div>
          <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-sm text-neutral-600 mt-2 max-w-2xl leading-relaxed font-sans">
              {project.description}
            </p>
          )}
          {project.learning_goal && (
            <p className="text-xs text-neutral-700 font-medium mt-2 flex items-center gap-1.5">
              <span className="text-neutral-400">🎯 Goal:</span> {project.learning_goal}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link href={`/projects/${project.id}/analytics`}>
            <Button
              variant="outline"
              size="sm"
              className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 px-3.5 rounded-xl font-medium shadow-xs transition-colors cursor-pointer"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
              Analytics
            </Button>
          </Link>
          <Link href={`/tutor?project=${project.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 px-3.5 rounded-xl font-medium shadow-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
              AI Tutor
            </Button>
          </Link>
          <Link href={`/quiz?project=${project.id}`}>
            <Button
              size="sm"
              className="bg-orange hover:bg-[#D44F19] text-white text-xs h-9 px-4 rounded-xl font-medium shadow-xs transition-colors cursor-pointer"
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              Quiz Me
            </Button>
          </Link>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <Alert className="border-rose-200 bg-rose-50 text-rose-800 text-xs py-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <AlertDescription className="text-rose-800">{uploadError}</AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUploadError(null)}
            className="h-6 px-2 text-rose-700 hover:text-rose-900 text-xs cursor-pointer"
          >
            Dismiss
          </Button>
        </Alert>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F5F3EE] text-ink shrink-0">
            <FileText className="h-4 w-4 text-neutral-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink tracking-tight font-sans">
              {readyMaterials.length}
              <span className="text-xs text-neutral-400 font-normal ml-1">
                /{materials.length}
              </span>
            </p>
            <p className="text-[11px] text-neutral-500 font-sans">Materials Ready</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F5F3EE] text-ink shrink-0">
            <Lightbulb className="h-4 w-4 text-orange" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink tracking-tight font-sans">{concepts.length}</p>
            <p className="text-[11px] text-neutral-500 font-sans">Concepts Extracted</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F5F3EE] text-ink shrink-0">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink tracking-tight font-sans">
              {mastery.length > 0 ? `${avgMastery}%` : "—"}
            </p>
            <p className="text-[11px] text-neutral-500 font-sans">Avg. Mastery</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F5F3EE] text-ink shrink-0">
            <FileCheck2 className="h-4 w-4 text-neutral-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink tracking-tight font-sans">
              {materials.reduce((sum, m) => sum + (m.page_count ?? 0), 0)}
            </p>
            <p className="text-[11px] text-neutral-500 font-sans">Pages Indexed</p>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Materials & Concepts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Materials List & Upload Zone */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
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
            className={`border border-dashed rounded-[24px] p-6 sm:p-8 text-center transition-all bg-white subtle-shadow ${
              dragActive
                ? "border-orange bg-orange/5"
                : "border-black/15 hover:border-black/30"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] border border-black/10 text-ink flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Upload className="h-5 w-5 text-neutral-700" />
            </div>
            <p className="text-xs sm:text-sm text-ink font-medium mb-1">
              Drag & drop lecture notes, PDFs, or Markdown here, or{" "}
              <label className="text-orange hover:underline cursor-pointer font-semibold">
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
            <p className="text-[11px] text-neutral-500 max-w-md mx-auto leading-relaxed">
              Supports PDF, Word (.docx), PowerPoint (.pptx), Markdown, and text files up to 50MB • Chunks & concepts indexed
            </p>
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-orange bg-orange/10 border border-orange/20 py-2 px-4 rounded-xl max-w-xs mx-auto text-xs font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading and queuing document…</span>
              </div>
            )}
          </div>

          {/* Materials Cards List */}
          {materials.length === 0 ? (
            <div className="p-8 rounded-2xl border border-black/10 bg-white subtle-shadow text-center text-xs text-neutral-500">
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
                  <div
                    key={mat.id}
                    className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow overflow-hidden space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-[#F5F3EE] border border-black/5 text-ink shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 text-neutral-700" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-ink truncate font-sans">
                            {mat.file_name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                            {mat.page_count && (
                              <span>{mat.page_count} pages</span>
                            )}
                            {mat.page_count && <span>•</span>}
                            <span>Added {formatRelativeTime(mat.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isReady && (
                          <span className="inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            Ready
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin text-amber-600" />
                            Processing
                          </span>
                        )}
                        {isQueued && (
                          <span className="inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-black/5 font-medium">
                            <Clock className="h-3 w-3 mr-1 text-neutral-500" />
                            Queued
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                            <XCircle className="h-3 w-3 mr-1 text-rose-600" />
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Processing Progressive Experience */}
                    {isProcessing && (
                      <div className="p-3.5 rounded-xl bg-[#F9F8F5] border border-black/5 text-xs space-y-1.5">
                        <p className="text-neutral-700 font-medium text-[11px] mb-2">
                          Background Knowledge Ingestion:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span>Upload complete</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span>Extracting content</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                            <Loader2 className="h-3 w-3 animate-spin shrink-0 text-amber-600" />
                            <span>Building representations</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            <span className="w-2.5 h-2.5 rounded-full border border-neutral-300 shrink-0 ml-0.5" />
                            <span>Indexing concepts</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Failure Explanation */}
                    {isFailed && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                        <p className="font-semibold">Processing could not be completed:</p>
                        <p className="text-[11px] text-rose-700">
                          {mat.error_message || "The file structure could not be parsed. Ensure the file contains readable text."}
                        </p>
                      </div>
                    )}

                    {/* Material Actions */}
                    {isReady && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t hairline">
                        <Link href={`/quiz?project=${project.id}&material=${mat.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-orange hover:text-[#D44F19] hover:bg-orange/10 px-2.5 rounded-lg font-medium cursor-pointer"
                          >
                            <ClipboardCheck className="h-3 w-3 mr-1" />
                            Quiz this doc
                          </Button>
                        </Link>
                        <Link href={`/tutor?project=${project.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-neutral-700 hover:text-ink hover:bg-neutral-100 px-2.5 rounded-lg font-medium cursor-pointer"
                          >
                            <MessageSquare className="h-3 w-3 mr-1 text-neutral-500" />
                            Ask Tutor
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Extracted Concepts Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
              Concepts ({concepts.length})
            </h2>
          </div>

          {concepts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/10 p-6 text-center subtle-shadow">
              <Lightbulb className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-ink">
                No concepts extracted yet
              </p>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Upload and process a material to automatically extract and track concept mastery.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {concepts.map((concept) => {
                const cm = masteryMap.get(concept.id);
                const score = cm?.mastery_score ?? 0;
                const trend = cm?.trend;

                return (
                  <div
                    key={concept.id}
                    className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-ink truncate font-sans">
                        {concept.name}
                      </h4>
                      <span className="text-[11px] font-bold text-neutral-700 shrink-0">
                        {score > 0 ? `${score.toFixed(0)}%` : "Unrated"}
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-ink rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      />
                    </div>

                    {concept.description && (
                      <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                        {concept.description}
                      </p>
                    )}

                    {trend && (
                      <div className="flex items-center justify-between pt-1 border-t hairline text-[10px] text-neutral-400">
                        <span>Trend: {trend.replace(/_/g, " ")}</span>
                        <Link
                          href={`/quiz?project=${project.id}`}
                          className="text-orange hover:underline font-medium flex items-center gap-0.5"
                        >
                          Practice <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
