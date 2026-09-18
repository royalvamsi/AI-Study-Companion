"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Plus,
  FolderKanban,
  FileText,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  Loader2,
  Sparkles,
  ArrowRight,
  Target,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Trash2,
} from "lucide-react";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  learning_goal: string | null;
  space_id: string;
  created_at: string;
  updated_at: string;
  spaces?: { name: string } | null;
  materials?: Array<{ id: string; status: string; file_name: string; page_count: number | null }>;
  concepts?: Array<{ id: string }>;
}

interface SpaceItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  projects?: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface RecommendationItem {
  id: string;
  project_id: string;
  concept_id: string | null;
  priority: string;
  action_type: string;
  reasoning: string | null;
  projects?: { id: string; name: string } | null;
  concepts?: { id: string; name: string } | null;
}

interface SnapshotData {
  totalConcepts: number;
  avgScore: number | null;
  quizzesTaken: number;
  overallMastery: number | null;
}

export interface RecentProjectItem extends ProjectItem {
  averageMastery?: number;
}

export interface AttentionConceptItem {
  conceptId: string;
  projectId: string;
  conceptName: string;
  projectName: string;
  masteryScore: number;
  trend: string;
  assessmentCount: number;
}

interface DashboardContentProps {
  userId: string;
  userName: string;
  spaces: SpaceItem[];
  projects: ProjectItem[];
  recentProjects?: RecentProjectItem[];
  continueProject: ProjectItem | null;
  continueProjectMastery: number | null;
  latestActivity?: ActivityEvent | null;
  attentionItems?: AttentionConceptItem[];
  snapshot: SnapshotData;
  topRecommendation: RecommendationItem | null;
  recentActivity: ActivityEvent[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const eventTypeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  MATERIAL_READY: { label: "Material processed", icon: FileText, color: "text-neutral-700 bg-neutral-100 border-black/5" },
  MATERIAL_PROCESSING: { label: "Processing document", icon: FileText, color: "text-amber-800 bg-amber-50 border-amber-200" },
  TUTOR_MESSAGE: { label: "Studied with AI Tutor", icon: MessageSquare, color: "text-[#E85D24] bg-orange-50 border-orange/20" },
  QUIZ_COMPLETED: { label: "Completed assessment", icon: ClipboardCheck, color: "text-emerald-800 bg-emerald-50 border-emerald-200" },
  MASTERY_UPDATED: { label: "Concept mastery updated", icon: TrendingUp, color: "text-neutral-800 bg-neutral-100 border-black/5" },
  RECOMMENDATION_CREATED: { label: "New recommendation generated", icon: Sparkles, color: "text-amber-800 bg-amber-50 border-amber-200" },
};

export function DashboardContent({
  userName,
  spaces,
  projects,
  recentProjects = [],
  continueProject,
  continueProjectMastery,
  latestActivity = null,
  attentionItems = [],
  snapshot,
  topRecommendation,
  recentActivity,
}: DashboardContentProps) {
  const router = useRouter();
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [createSpaceError, setCreateSpaceError] = useState<string | null>(null);
  const [spaceToDelete, setSpaceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [deleteSpaceError, setDeleteSpaceError] = useState<string | null>(null);

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = spaceName.trim();
    if (!trimmedName || creatingSpace) return;
    setCreatingSpace(true);
    setCreateSpaceError(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: spaceDescription.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setCreateSpaceError(
          data?.error || "Unable to create Space. Please try again."
        );
        return;
      }

      setCreateSpaceOpen(false);
      setSpaceName("");
      setSpaceDescription("");
      setCreateSpaceError(null);
      router.refresh();
    } catch {
      setCreateSpaceError("Network error. Please check your connection and try again.");
    } finally {
      setCreatingSpace(false);
    }
  }

  async function handleDeleteSpace() {
    if (!spaceToDelete || deletingSpace) return;
    setDeletingSpace(true);
    setDeleteSpaceError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setDeleteSpaceError(
          data?.error || "Unable to delete Space. Please try again."
        );
        return;
      }

      setSpaceToDelete(null);
      setDeleteSpaceError(null);
      router.refresh();
    } catch {
      setDeleteSpaceError("Network error. Please check your connection and try again.");
    } finally {
      setDeletingSpace(false);
    }
  }

  const greeting = getGreeting();
  const hasProjects = projects.length > 0;

  return (
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-10 selection:bg-orange/20 selection:text-orange">
      {/* 1. Greeting / Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b hairline">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
              Workspace
            </span>
          </div>
          <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-neutral-600 mt-2 font-sans">
            Welcome back to your learning workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Dialog
            open={createSpaceOpen}
            onOpenChange={(open) => {
              setCreateSpaceOpen(open);
              if (!open) {
                setCreateSpaceError(null);
              }
            }}
          >
            <DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 px-3.5 rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                New Space
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border border-black/10 text-ink max-w-md rounded-[24px] p-6 shadow-xl">
              <DialogHeader className="space-y-1">
                <DialogTitle className="display text-2xl font-bold text-ink">
                  Create a Study Space
                </DialogTitle>
                <DialogDescription className="text-neutral-500 text-xs leading-relaxed">
                  Spaces organize multiple related projects (e.g. &ldquo;Computer Science&rdquo; or &ldquo;Biology 101&rdquo;).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSpace} className="space-y-4 pt-2">
                {createSpaceError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{createSpaceError}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Name
                  </Label>
                  <Input
                    value={spaceName}
                    onChange={(e) => {
                      setSpaceName(e.target.value);
                      if (createSpaceError) setCreateSpaceError(null);
                    }}
                    placeholder="e.g., Artificial Intelligence"
                    required
                    disabled={creatingSpace}
                    maxLength={100}
                    className="bg-white border-black/15 text-ink text-sm rounded-xl h-10 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Description (optional)
                  </Label>
                  <Textarea
                    value={spaceDescription}
                    onChange={(e) => setSpaceDescription(e.target.value)}
                    placeholder="What will you study in this space?"
                    rows={2}
                    disabled={creatingSpace}
                    className="bg-white border-black/15 text-ink text-sm rounded-xl resize-none placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creatingSpace || !spaceName.trim()}
                  className="w-full bg-orange hover:bg-[#D44F19] text-white text-xs font-medium h-10 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  {creatingSpace ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Creating space…
                    </>
                  ) : (
                    "Create Space"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Link href="/projects">
            <Button
              size="sm"
              className="bg-ink hover:bg-neutral-800 text-white text-xs h-9 px-3.5 rounded-xl shadow-xs transition-colors"
            >
              <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
              All Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Delete Space Confirmation Dialog */}
      <Dialog
        open={spaceToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingSpace) {
            setSpaceToDelete(null);
            setDeleteSpaceError(null);
          }
        }}
      >
        <DialogContent className="bg-white border border-black/10 text-ink max-w-md rounded-[24px] p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="display text-2xl font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Delete this Study Space?
            </DialogTitle>
            <DialogDescription className="text-neutral-600 text-xs pt-1.5 leading-relaxed">
              This will permanently delete the Space{" "}
              <strong className="text-ink font-semibold">
                &ldquo;{spaceToDelete?.name}&rdquo;
              </strong>{" "}
              and any data that is configured to be removed with it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteSpaceError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{deleteSpaceError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={deletingSpace}
              onClick={() => {
                setSpaceToDelete(null);
                setDeleteSpaceError(null);
              }}
              className="border-black/10 bg-white hover:bg-neutral-50 text-neutral-700 text-xs h-9 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deletingSpace}
              onClick={handleDeleteSpace}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-4 rounded-xl cursor-pointer font-medium shadow-xs"
            >
              {deletingSpace ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Deleting Space…
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Space
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account with 0 Projects Empty States */}
      {!hasProjects ? (
        spaces && spaces.length > 0 ? (
          <div className="p-8 sm:p-12 rounded-[24px] bg-white border border-black/10 subtle-shadow text-center space-y-4 my-6">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F3EE] border border-black/10 text-ink flex items-center justify-center mx-auto shadow-xs">
              <BookOpen className="h-6 w-6 text-ink" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="display text-2xl font-bold text-ink">Your study space is ready</h3>
              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Now create your first study project inside a space to upload lecture slides, PDF notes, or textbooks and unlock AI-powered study tools.
              </p>
            </div>
            <div className="pt-2">
              <Link href={`/projects?space=${spaces[0].id}`}>
                <Button size="sm" className="bg-orange hover:bg-[#D44F19] text-white text-xs h-10 px-5 rounded-xl shadow-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create First Project in {spaces[0].name}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Your learning workspace is ready"
            description="Create your first study project to upload lecture slides, PDF notes, or textbooks and unlock AI-powered study tools."
            actionLabel="Create First Project"
            actionHref="/projects"
            className="my-8 py-16 bg-white border border-black/10 rounded-[26px] subtle-shadow"
          >
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
              <div className="p-5 rounded-2xl bg-[#F9F8F5] border border-black/5">
                <FileText className="h-5 w-5 text-neutral-700 mb-2" />
                <h4 className="text-xs font-semibold text-ink">1. Upload Materials</h4>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  Upload lecture notes or textbooks in PDF format.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#F9F8F5] border border-black/5">
                <MessageSquare className="h-5 w-5 text-orange mb-2" />
                <h4 className="text-xs font-semibold text-ink">2. Grounded Tutor</h4>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  Ask questions backed by exact source citations.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#F9F8F5] border border-black/5">
                <ClipboardCheck className="h-5 w-5 text-emerald-600 mb-2" />
                <h4 className="text-xs font-semibold text-ink">3. Adaptive Quizzes</h4>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  Test your mastery and track learning growth.
                </p>
              </div>
            </div>
          </EmptyState>
        )
      ) : (
        <>
          {/* 2. CONTINUE LEARNING (Dominant Level 1 Surface) */}
          {continueProject && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                    Continue Learning
                  </h2>
                </div>
                <Link
                  href="/projects"
                  className="text-xs text-neutral-600 hover:text-ink font-medium transition-colors flex items-center gap-1 group"
                >
                  <span>All projects ({projects.length})</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="bg-white rounded-[24px] border border-black/10 p-6 sm:p-8 product-shadow overflow-hidden transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
                  <div className="space-y-4 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {continueProject.spaces?.name && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-700 text-[11px] font-medium">
                          <FolderKanban className="h-3 w-3 text-neutral-500" />
                          {continueProject.spaces.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange/10 text-orange border border-orange/20 text-[11px] font-semibold">
                        Active Project
                      </span>
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1 ml-1">
                        <Clock className="h-3 w-3" />
                        Last active {formatRelativeTime(continueProject.updated_at)}
                      </span>
                    </div>

                    <div>
                      <h3 className="display text-2xl sm:text-3xl lg:text-4xl text-ink tracking-tight leading-tight">
                        {continueProject.name}
                      </h3>
                      {continueProject.description && (
                        <p className="text-sm text-neutral-600 mt-2 line-clamp-2 leading-relaxed max-w-2xl font-sans">
                          {continueProject.description}
                        </p>
                      )}
                      {continueProject.learning_goal && (
                        <p className="text-xs text-neutral-700 mt-2 flex items-center gap-1.5 font-medium">
                          <span className="text-neutral-400">🎯 Goal:</span> {continueProject.learning_goal}
                        </p>
                      )}
                    </div>

                    {/* Latest Activity Context Line */}
                    {latestActivity && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700 bg-[#F9F8F5] border border-black/5 px-3 py-1.5 rounded-xl max-w-fit">
                        <Clock className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                        <span>
                          Recent:{" "}
                          <strong className="font-semibold text-ink">
                            {eventTypeMeta[latestActivity.event_type]?.label ||
                              latestActivity.event_type.replace(/_/g, " ")}
                          </strong>
                        </span>
                        {latestActivity.payload &&
                          typeof latestActivity.payload === "object" &&
                          "fileName" in latestActivity.payload &&
                          typeof latestActivity.payload.fileName === "string" && (
                            <span className="text-neutral-500">
                              ({latestActivity.payload.fileName})
                            </span>
                          )}
                        {latestActivity.payload &&
                          typeof latestActivity.payload === "object" &&
                          "score" in latestActivity.payload &&
                          typeof latestActivity.payload.score === "number" && (
                            <span className="text-emerald-600 font-semibold">
                              ({latestActivity.payload.score}%)
                            </span>
                          )}
                      </div>
                    )}

                    {/* Project Metrics */}
                    <div className="flex flex-wrap items-center gap-5 text-xs text-neutral-500 pt-1">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-neutral-400" />
                        <strong className="text-ink font-semibold">
                          {continueProject.materials?.filter((m) => m.status === "ready").length ?? 0}
                        </strong>{" "}
                        ready materials
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
                        <strong className="text-ink font-semibold">
                          {continueProject.concepts?.length ?? 0}
                        </strong>{" "}
                        concepts
                      </span>
                      {continueProjectMastery !== null && (
                        <span className="flex items-center gap-1.5 text-neutral-800 font-medium">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          <strong className="text-ink font-bold">{continueProjectMastery}%</strong> Mastery
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2.5 shrink-0 lg:w-52">
                    <Link href={`/projects/${continueProject.id}`} className="w-full">
                      <Button
                        className="w-full bg-orange hover:bg-[#D44F19] text-white font-medium text-sm h-11 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Continue Project</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <div className="flex items-center gap-2 w-full">
                      <Link href={`/tutor?project=${continueProject.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 rounded-xl font-medium cursor-pointer"
                        >
                          <MessageSquare className="h-3 w-3 mr-1.5 text-neutral-500" />
                          Tutor
                        </Button>
                      </Link>
                      <Link href={`/quiz?project=${continueProject.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 rounded-xl font-medium cursor-pointer"
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1.5 text-neutral-500" />
                          Quiz
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. LEARNING SNAPSHOT (Calm Progress Overview) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                Learning Snapshot
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Concepts Mastered */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between">
                <span className="text-[11px] uppercase tracking-[.14em] font-semibold text-neutral-500">
                  Concepts Mastered
                </span>
                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight font-sans">
                    {snapshot.totalConcepts}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    Extracted from materials
                  </p>
                </div>
              </div>

              {/* Overall Mastery */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between">
                <span className="text-[11px] uppercase tracking-[.14em] font-semibold text-neutral-500">
                  Overall Mastery
                </span>
                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight font-sans">
                    {snapshot.overallMastery !== null ? `${snapshot.overallMastery}%` : "—"}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    {snapshot.overallMastery !== null ? "Across all concepts" : "Awaiting quiz data"}
                  </p>
                </div>
              </div>

              {/* Average Quiz Score */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between">
                <span className="text-[11px] uppercase tracking-[.14em] font-semibold text-neutral-500">
                  Average Quiz Score
                </span>
                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight font-sans">
                    {snapshot.avgScore !== null ? `${snapshot.avgScore}%` : "—"}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    {snapshot.quizzesTaken > 0 ? "From completed tests" : "No quizzes taken"}
                  </p>
                </div>
              </div>

              {/* Quizzes Completed */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between">
                <span className="text-[11px] uppercase tracking-[.14em] font-semibold text-neutral-500">
                  Quizzes Completed
                </span>
                <div className="mt-3">
                  <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight font-sans">
                    {snapshot.quizzesTaken}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    Adaptive assessments
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. ACTIVE RECOMMENDATION (Answers "What should I do next?") */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                  Active Recommendation
                </h2>
              </div>
              <Link
                href="/recommendations"
                className="text-xs text-neutral-600 hover:text-ink font-medium transition-colors flex items-center gap-1 group"
              >
                <span>All tasks</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {topRecommendation ? (
              <div className="bg-white rounded-[24px] border border-black/10 p-6 sm:p-7 subtle-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold uppercase tracking-wider">
                        {topRecommendation.priority} Priority
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-700 text-[10px] uppercase font-medium">
                        {topRecommendation.action_type.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-ink leading-snug">
                        {topRecommendation.concepts?.name
                          ? `Strengthen: ${topRecommendation.concepts.name}`
                          : `Review: ${topRecommendation.projects?.name ?? "Study Material"}`}
                      </h3>
                      {topRecommendation.projects?.name && (
                        <p className="text-xs text-neutral-500 mt-1">
                          In project: <span className="text-neutral-800 font-medium">{topRecommendation.projects.name}</span>
                        </p>
                      )}
                    </div>

                    {topRecommendation.reasoning && (
                      <div className="p-3.5 rounded-xl bg-[#F9F8F5] border border-black/5 text-xs text-neutral-600 leading-relaxed max-w-2xl">
                        <span className="font-semibold text-ink block mb-0.5">Why this is recommended:</span>
                        {topRecommendation.reasoning}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap lg:flex-col items-stretch gap-2.5 shrink-0 lg:w-52">
                    <Link href={`/tutor?project=${topRecommendation.project_id}`} className="flex-1 lg:flex-initial">
                      <Button
                        className="w-full bg-ink hover:bg-neutral-800 text-white font-medium text-xs h-10 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                        Start Review with Tutor
                      </Button>
                    </Link>
                    <Link href={`/quiz?project=${topRecommendation.project_id}`} className="flex-1 lg:flex-initial">
                      <Button
                        variant="outline"
                        className="w-full border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-10 px-4 rounded-xl font-medium cursor-pointer"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                        Take Quiz
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/10 p-6 text-center subtle-shadow flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-8 w-8 text-neutral-400 mb-2" />
                <p className="text-sm font-semibold text-ink">You are all caught up!</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm leading-relaxed">
                  As you take quizzes and study with the AI Tutor, smart recommendations will automatically appear here.
                </p>
              </div>
            )}
          </div>

          {/* 5. AREAS REQUIRING ATTENTION (Supportive Tone) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                  Areas Requiring Attention
                </h2>
              </div>
              <Link
                href="/growth"
                className="text-xs text-neutral-600 hover:text-ink font-medium transition-colors flex items-center gap-1 group"
              >
                <span>Full growth analysis</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {attentionItems && attentionItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {attentionItems.map((item) => (
                  <div
                    key={`${item.projectId}-${item.conceptId}`}
                    className="bg-white rounded-2xl border border-black/10 p-4 subtle-shadow flex flex-col justify-between hover:border-black/20 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[10px] font-medium">
                          Needs Focus
                        </span>
                        <span className="text-xs font-bold text-neutral-800">{item.masteryScore}% Mastery</span>
                      </div>
                      <h4 className="text-sm font-semibold text-ink leading-snug truncate pt-1">
                        {item.conceptName}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate">
                        In: {item.projectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t hairline">
                      <Link href={`/tutor?project=${item.projectId}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-black/10 bg-white hover:bg-neutral-50 text-ink text-[11px] h-7 px-2 rounded-lg font-medium cursor-pointer"
                        >
                          <MessageSquare className="h-3 w-3 mr-1 text-neutral-400" />
                          Review
                        </Button>
                      </Link>
                      <Link href={`/quiz?project=${item.projectId}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-black/10 bg-white hover:bg-neutral-50 text-ink text-[11px] h-7 px-2 rounded-lg font-medium cursor-pointer"
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1 text-neutral-400" />
                          Quiz
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow">
                <div className="flex items-center gap-3 text-xs">
                  <div className="p-2 rounded-xl bg-[#F5F3EE] text-ink shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink">All concepts in good standing</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      No concepts currently have a declining trend or mastery below 60%. Keep up the regular quiz practice!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. RECENT PROJECTS */}
          {recentProjects && recentProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                    Recent Projects
                  </h2>
                </div>
                <Link
                  href="/projects"
                  className="text-xs text-neutral-600 hover:text-ink font-medium transition-colors flex items-center gap-1 group"
                >
                  <span>All spaces & projects ({projects.length})</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentProjects.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between hover:border-black/20 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-sm font-semibold text-ink truncate font-sans">{p.name}</h3>
                        {p.spaces?.name && (
                          <span className="text-[10px] px-2 py-0.5 shrink-0 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-600 font-medium">
                            {p.spaces.name}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-3 mt-3 border-t hairline">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-neutral-500">
                          <span>Mastery</span>
                          <span className="font-semibold text-ink">{p.averageMastery ?? 0}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full bg-ink rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, p.averageMastery ?? 0))}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">
                          {p.materials?.filter((m) => m.status === "ready").length ?? 0} materials
                        </span>
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-ink hover:text-orange font-medium flex items-center gap-1 transition-colors"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. SPACES & ORGANIZATION */}
          {spaces && spaces.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                    Study Spaces ({spaces.length})
                  </h2>
                </div>
                <Link
                  href="/projects"
                  className="text-xs text-neutral-600 hover:text-ink font-medium transition-colors flex items-center gap-1 group"
                >
                  <span>All spaces ({spaces.length})</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {spaces.map((space) => {
                  const projectCount = space.projects?.length ?? 0;
                  return (
                    <div
                      key={space.id}
                      className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between hover:border-black/20 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-ink truncate flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-neutral-500 shrink-0" />
                            <span className="truncate">{space.name}</span>
                          </h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-600 font-medium">
                              {projectCount} {projectCount === 1 ? "project" : "projects"}
                            </span>
                            <button
                              type="button"
                              title="Delete Space"
                              onClick={() => {
                                setSpaceToDelete({ id: space.id, name: space.name });
                                setDeleteSpaceError(null);
                              }}
                              className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {space.description && (
                          <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                            {space.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t hairline text-[11px]">
                        <span className="text-neutral-400 text-[10px]">
                          Created {formatRelativeTime(space.created_at)}
                        </span>
                        <Link
                          href={`/projects?space=${space.id}`}
                          className="text-ink hover:text-orange font-medium flex items-center gap-1 transition-colors"
                        >
                          {projectCount > 0 ? "View Projects" : "+ Add Project"} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8. RECENT ACTIVITY (Lightweight Editorial Timeline) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                  Recent Activity
                </h2>
              </div>
              <span className="text-[11px] text-neutral-400">Live events</span>
            </div>

            <div className="bg-white rounded-2xl border border-black/10 p-6 subtle-shadow">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs font-sans">
                  No recent activity yet. Upload materials or start a quiz to see your learning timeline.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((evt, idx) => {
                    const meta = eventTypeMeta[evt.event_type] ?? {
                      label: evt.event_type.replace(/_/g, " "),
                      icon: Sparkles,
                      color: "text-neutral-700 bg-neutral-100 border-black/5",
                    };
                    const Icon = meta.icon;

                    return (
                      <div
                        key={evt.id}
                        className={`flex items-start gap-3.5 text-xs group ${
                          idx !== recentActivity.length - 1 ? "pb-4 border-b hairline" : ""
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 border ${meta.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="font-medium text-ink truncate">
                            {meta.label}
                          </p>
                          {evt.payload && typeof evt.payload === "object" && (
                            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {(evt.payload as any).file_name ||
                                (evt.payload as any).topic ||
                                ((evt.payload as any).score !== undefined
                                  ? `Score: ${(evt.payload as any).score}%`
                                  : null)}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 shrink-0 pt-0.5">
                          {formatRelativeTime(evt.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
