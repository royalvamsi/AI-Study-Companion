"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Upload,
  Lightbulb,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
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

const statusConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  ready: { icon: CheckCircle, color: "text-emerald-400", label: "Ready" },
  processing: { icon: Loader2, color: "text-amber-400", label: "Processing" },
  queued: { icon: Clock, color: "text-slate-400", label: "Queued" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
};

export function ProjectDetailContent({
  project,
  materials,
  concepts,
  mastery,
  userId,
}: ProjectDetailContentProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const masteryMap = new Map(mastery.map((m) => [m.concept_id, m]));
  const avgMastery =
    mastery.length > 0
      ? mastery.reduce((sum, m) => sum + m.mastery_score, 0) / mastery.length
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
      if (file.type !== "application/pdf") {
        alert("Only PDF files are supported.");
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
            .catch(() => ({ error: `Upload failed (Status ${res.status})` }));
          alert(err.error || "Upload failed");
          return;
        }

        router.refresh();
      } catch (err) {
        console.error("Upload error:", err);
        alert(err instanceof Error ? err.message : "Upload request failed");
      } finally {
        setUploading(false);
      }
    },
    [project.id, router]
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/projects")}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-slate-400 text-sm mt-0.5">{project.description}</p>
          )}
          {project.learning_goal && (
            <p className="text-indigo-400/80 text-xs mt-1">
              🎯 {project.learning_goal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/tutor?project=${project.id}`}>
            <Button variant="outline" size="sm" className="text-slate-300">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Tutor
            </Button>
          </Link>
          <Link href={`/quiz?project=${project.id}`}>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <ClipboardCheck className="h-4 w-4 mr-1.5" />
              Quiz me
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <FileText className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {materials.filter((m) => m.status === "ready").length}
                </p>
                <p className="text-xs text-slate-500">Materials ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Lightbulb className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{concepts.length}</p>
                <p className="text-xs text-slate-500">Concepts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {avgMastery.toFixed(0)}%
                </p>
                <p className="text-xs text-slate-500">Avg. mastery</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {materials.reduce((sum, m) => sum + (m.page_count ?? 0), 0)}
                </p>
                <p className="text-xs text-slate-500">Pages processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Materials section */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            Materials
          </h2>

          {/* Upload zone */}
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
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? "border-indigo-500 bg-indigo-500/5"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            <Upload
              className={`h-8 w-8 mx-auto mb-3 ${
                dragActive ? "text-indigo-400" : "text-slate-600"
              }`}
            />
            <p className="text-sm text-slate-400 mb-2">
              Drag & drop a PDF here, or{" "}
              <label className="text-indigo-400 hover:text-indigo-300 cursor-pointer">
                browse
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
            </p>
            <p className="text-xs text-slate-600">PDF files up to 10MB</p>
            {uploading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading…</span>
              </div>
            )}
          </div>

          {/* Materials list */}
          {materials.length > 0 && (
            <div className="space-y-2">
              {materials.map((mat) => {
                const cfg = statusConfig[mat.status] ?? statusConfig.queued;
                const StatusIcon = cfg.icon;

                return (
                  <Card
                    key={mat.id}
                    className="bg-slate-900/40 border-slate-800/50"
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="p-1.5 rounded bg-slate-800/80">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {mat.file_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {mat.page_count
                            ? `${mat.page_count} pages`
                            : cfg.label}
                          {mat.error_message &&
                            ` — ${mat.error_message}`}
                        </p>
                      </div>
                      <StatusIcon
                        className={`h-4 w-4 flex-shrink-0 ${cfg.color} ${
                          mat.status === "processing" ? "animate-spin" : ""
                        }`}
                      />
                      {mat.status === "ready" && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/quiz?project=${project.id}&material=${mat.id}`)}
                            className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2"
                          >
                            Quiz me
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/tutor?project=${project.id}`)}
                            className="h-7 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2"
                          >
                            Tutor
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Concepts sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-slate-500" />
            Concepts
          </h2>

          {concepts.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardContent className="py-8 text-center">
                <Lightbulb className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  Concepts will appear after processing materials.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {concepts.map((concept) => {
                const cm = masteryMap.get(concept.id);
                const score = cm?.mastery_score ?? 0;
                const trendIcon =
                  cm?.trend === "IMPROVING"
                    ? "📈"
                    : cm?.trend === "NEEDS_ATTENTION"
                    ? "⚠️"
                    : "";

                return (
                  <Card
                    key={concept.id}
                    className="bg-slate-900/40 border-slate-800/50"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          {concept.name}
                        </p>
                        <span className="text-xs text-slate-500">
                          {score.toFixed(0)}% {trendIcon}
                        </span>
                      </div>
                      <Progress
                        value={score}
                        className="h-1.5"
                      />
                      {concept.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {concept.description}
                        </p>
                      )}
                    </CardContent>
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
