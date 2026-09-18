"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Award,
  BookOpen,
  CheckCircle2,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingDown,
  AlertCircle,
  Layers,
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
  MATERIAL_READY: { label: "Material processed", icon: FileText, color: "text-emerald-400 bg-emerald-500/10" },
  MATERIAL_PROCESSING: { label: "Processing document", icon: FileText, color: "text-amber-400 bg-amber-500/10" },
  TUTOR_MESSAGE: { label: "Studied with AI Tutor", icon: MessageSquare, color: "text-indigo-400 bg-indigo-500/10" },
  QUIZ_COMPLETED: { label: "Completed assessment", icon: ClipboardCheck, color: "text-violet-400 bg-violet-500/10" },
  MASTERY_UPDATED: { label: "Concept mastery updated", icon: TrendingUp, color: "text-cyan-400 bg-cyan-500/10" },
  RECOMMENDATION_CREATED: { label: "New recommendation generated", icon: Sparkles, color: "text-amber-400 bg-amber-500/10" },
};

export function DashboardContent({
  userId,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Greeting & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Welcome back to your intelligent study companion.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
                className="border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs h-9 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Space
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
              <DialogHeader>
                <DialogTitle>Create a Study Space</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Spaces organize multiple related projects (e.g. "Computer Science" or "Biology 101").
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSpace} className="space-y-4 pt-2">
                {createSpaceError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{createSpaceError}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Name</Label>
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
                    className="bg-slate-800/60 border-slate-700 text-white text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Description (optional)</Label>
                  <Textarea
                    value={spaceDescription}
                    onChange={(e) => setSpaceDescription(e.target.value)}
                    placeholder="What will you study in this space?"
                    rows={2}
                    disabled={creatingSpace}
                    className="bg-slate-800/60 border-slate-700 text-white text-sm resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creatingSpace || !spaceName.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 cursor-pointer"
                >
                  {creatingSpace ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Creating space…</>
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm text-xs h-9"
            >
              <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
              All Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Study Spaces Section */}
      {spaces && spaces.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Study Spaces ({spaces.length})
            </h2>
            <Link
              href="/projects"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
            >
              All Spaces & Projects ({projects.length}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {spaces.map((space) => {
              const projectCount = space.projects?.length ?? 0;
              return (
                <Card
                  key={space.id}
                  className="border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition-colors backdrop-blur-sm flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white truncate flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span className="truncate">{space.name}</span>
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400"
                        >
                          {projectCount} {projectCount === 1 ? "project" : "projects"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Space"
                          onClick={() => {
                            setSpaceToDelete({ id: space.id, name: space.name });
                            setDeleteSpaceError(null);
                          }}
                          className="h-6 w-6 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {space.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {space.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-500 text-[10px]">
                        Created {formatRelativeTime(space.created_at)}
                      </span>
                      <Link
                        href={`/projects?space=${space.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                      >
                        {projectCount > 0 ? "View Projects" : "+ Add Project"} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

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
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Delete this Study Space?
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs pt-1.5 leading-relaxed">
              This will permanently delete the Space{" "}
              <strong className="text-white font-semibold">
                "{spaceToDelete?.name}"
              </strong>{" "}
              and any data that is configured to be removed with it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteSpaceError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
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
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deletingSpace}
              onClick={handleDeleteSpace}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-9 cursor-pointer font-medium"
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

      {/* Account with 0 Projects */}
      {!hasProjects ? (
        spaces && spaces.length > 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center space-y-4 my-4">
            <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400 w-fit mx-auto">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-white">Your study space is ready</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Now create your first study project inside a space to upload lecture slides, PDF notes, or textbooks and unlock AI-powered study tools.
              </p>
            </div>
            <div className="pt-2">
              <Link href={`/projects?space=${spaces[0].id}`}>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9">
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
            className="my-8 py-16"
          >
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <FileText className="h-5 w-5 text-indigo-400 mb-2" />
                <h4 className="text-xs font-semibold text-white">1. Upload Materials</h4>
                <p className="text-[11px] text-slate-400 mt-1">Upload lecture notes or textbooks in PDF format.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <MessageSquare className="h-5 w-5 text-violet-400 mb-2" />
                <h4 className="text-xs font-semibold text-white">2. Grounded Tutor</h4>
                <p className="text-[11px] text-slate-400 mt-1">Ask questions backed by exact source citations.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <ClipboardCheck className="h-5 w-5 text-emerald-400 mb-2" />
                <h4 className="text-xs font-semibold text-white">3. Adaptive Quizzes</h4>
                <p className="text-[11px] text-slate-400 mt-1">Test your mastery and track learning growth.</p>
              </div>
            </div>
          </EmptyState>
        )
      ) : (
        <>
          {/* Section 1: Continue Learning Hero Card (A1) */}
          {continueProject && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-400" />
                  Continue Learning
                </h2>
                <Link
                  href="/projects"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
                >
                  View all ({projects.length}) <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <Card className="border-slate-800/90 bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-md shadow-lg overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {continueProject.spaces?.name && (
                          <Badge
                            variant="outline"
                            className="bg-slate-800/80 text-slate-300 border-slate-700 text-[11px] font-medium"
                          >
                            <FolderKanban className="h-3 w-3 mr-1 text-slate-400" />
                            {continueProject.spaces.name}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-[11px] font-medium"
                        >
                          Active Project
                        </Badge>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active {formatRelativeTime(continueProject.updated_at)}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                          {continueProject.name}
                        </h3>
                        {continueProject.description && (
                          <p className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {continueProject.description}
                          </p>
                        )}
                        {continueProject.learning_goal && (
                          <p className="text-xs text-indigo-300/90 mt-2 flex items-center gap-1.5 font-medium">
                            <span>🎯 Goal:</span> {continueProject.learning_goal}
                          </p>
                        )}
                      </div>

                      {/* Latest Activity Context Line */}
                      {latestActivity && (
                        <div className="flex items-center gap-2 text-xs text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md max-w-fit">
                          <Clock className="h-3 w-3 text-indigo-400 shrink-0" />
                          <span>
                            Recent:{" "}
                            <strong className="font-semibold text-white">
                              {eventTypeMeta[latestActivity.event_type]?.label ||
                                latestActivity.event_type.replace(/_/g, " ")}
                            </strong>
                          </span>
                          {latestActivity.payload &&
                            typeof latestActivity.payload === "object" &&
                            "fileName" in latestActivity.payload &&
                            typeof latestActivity.payload.fileName === "string" && (
                              <span className="text-slate-300">
                                ({latestActivity.payload.fileName})
                              </span>
                            )}
                          {latestActivity.payload &&
                            typeof latestActivity.payload === "object" &&
                            "score" in latestActivity.payload &&
                            typeof latestActivity.payload.score === "number" && (
                              <span className="text-emerald-400 font-semibold">
                                ({latestActivity.payload.score}%)
                              </span>
                            )}
                        </div>
                      )}

                      {/* Project Metrics pill */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          {continueProject.materials?.filter((m) => m.status === "ready").length ?? 0} ready materials
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                          {continueProject.concepts?.length ?? 0} concepts
                        </span>
                        {continueProjectMastery !== null && (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {continueProjectMastery}% Project Mastery
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap lg:flex-col items-stretch gap-2.5 shrink-0 lg:w-48">
                      <Link href={`/projects/${continueProject.id}`} className="flex-1 lg:flex-initial">
                        <Button
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs h-10 shadow-sm"
                        >
                          Continue Project
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </Link>
                      <div className="flex items-center gap-2 w-full">
                        <Link href={`/tutor?project=${continueProject.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs h-8"
                          >
                            <MessageSquare className="h-3 w-3 mr-1.5 text-indigo-400" />
                            Tutor
                          </Button>
                        </Link>
                        <Link href={`/quiz?project=${continueProject.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs h-8"
                          >
                            <ClipboardCheck className="h-3 w-3 mr-1.5 text-emerald-400" />
                            Quiz
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section 1.5: Recent Projects Bounded Grid (A2) */}
          {recentProjects && recentProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-sky-400" />
                  Recent Projects
                </h2>
                <Link
                  href="/projects"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
                >
                  All Spaces & Projects ({projects.length}) <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {recentProjects.map((p) => (
                  <Card
                    key={p.id}
                    className="border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition-colors backdrop-blur-sm flex flex-col justify-between"
                  >
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                        {p.spaces?.name && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 shrink-0 border-slate-700 text-slate-400"
                          >
                            {p.spaces.name}
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Mastery</span>
                          <span className="font-semibold text-slate-200">{p.averageMastery ?? 0}%</span>
                        </div>
                        <Progress value={p.averageMastery ?? 0} className="h-1 bg-slate-800" />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                        <span className="text-slate-400">
                          {p.materials?.filter((m) => m.status === "ready").length ?? 0} materials
                        </span>
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Learning Snapshot KPI Cards (A3) */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Your Learning Snapshot
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Concepts Tracked */}
              <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">Concepts Tracked</span>
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {snapshot.totalConcepts}
                  </div>
                  <p className="text-[11px] text-slate-400">Extracted from materials</p>
                </CardContent>
              </Card>

              {/* Overall Mastery */}
              <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">Overall Mastery</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {snapshot.overallMastery !== null ? `${snapshot.overallMastery}%` : "—"}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {snapshot.overallMastery !== null ? "Across all concepts" : "Awaiting quiz data"}
                  </p>
                </CardContent>
              </Card>

              {/* Average Quiz Score */}
              <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">Average Score</span>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <Award className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {snapshot.avgScore !== null ? `${snapshot.avgScore}%` : "—"}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {snapshot.quizzesTaken > 0 ? "From completed tests" : "No quizzes taken"}
                  </p>
                </CardContent>
              </Card>

              {/* Quizzes Completed */}
              <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">Quizzes Completed</span>
                    <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {snapshot.quizzesTaken}
                  </div>
                  <p className="text-[11px] text-slate-400">Adaptive assessments</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Section 2.5: Areas Requiring Attention (A4) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                Areas Requiring Attention
              </h2>
              <Link
                href="/growth"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
              >
                Full Growth Analysis <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {attentionItems && attentionItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {attentionItems.map((item) => (
                  <Card
                    key={`${item.projectId}-${item.conceptId}`}
                    className="border-rose-500/20 bg-rose-500/5 backdrop-blur-sm flex flex-col justify-between"
                  >
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <Badge
                          variant="outline"
                          className="border-rose-500/30 text-rose-300 bg-rose-500/10 text-[10px] font-semibold"
                        >
                          Needs Focus
                        </Badge>
                        <span className="text-xs font-bold text-rose-300">{item.masteryScore}% Mastery</span>
                      </div>
                      <CardTitle className="text-sm font-semibold text-white leading-snug truncate pt-1">
                        {item.conceptName}
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-400 truncate">
                        In: {item.projectName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                        <Link href={`/tutor?project=${item.projectId}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] h-7 px-2"
                          >
                            <MessageSquare className="h-3 w-3 mr-1 text-indigo-400" />
                            Review
                          </Button>
                        </Link>
                        <Link href={`/quiz?project=${item.projectId}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] h-7 px-2"
                          >
                            <ClipboardCheck className="h-3 w-3 mr-1 text-emerald-400" />
                            Quiz
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-slate-800/80 bg-slate-900/40 p-4">
                <div className="flex items-center gap-3 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">All concepts in good standing</p>
                    <p className="text-[11px] text-slate-400">
                      No concepts currently have a declining trend or mastery below 60%. Keep up the regular quiz practice!
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Section 3: Two-column layout (Recommended Next & Recent Activity) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended Next Action (A5) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Recommended Next
                </h2>
                <Link
                  href="/recommendations"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  All tasks
                </Link>
              </div>

              {topRecommendation ? (
                <Card className="border-slate-800/90 bg-slate-900/60 backdrop-blur-sm h-[calc(100%-2rem)] flex flex-col justify-between">
                  <CardHeader className="p-5 pb-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        {topRecommendation.priority} Priority
                      </Badge>
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                        {topRecommendation.action_type.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <CardTitle className="text-base font-semibold text-white leading-snug">
                      {topRecommendation.concepts?.name
                        ? `Strengthen: ${topRecommendation.concepts.name}`
                        : `Review: ${topRecommendation.projects?.name ?? "Study Material"}`}
                    </CardTitle>
                    {topRecommendation.projects?.name && (
                      <p className="text-xs text-slate-400">
                        In project: <span className="text-slate-300">{topRecommendation.projects.name}</span>
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {topRecommendation.reasoning && (
                      <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-200 block mb-1">Why this is recommended:</span>
                        {topRecommendation.reasoning}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Link href={`/tutor?project=${topRecommendation.project_id}`}>
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3.5 shadow-sm"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                          Start Review with Tutor
                        </Button>
                      </Link>
                      <Link href={`/quiz?project=${topRecommendation.project_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs h-8 px-3.5"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                          Take Quiz
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-800/80 bg-slate-900/40 p-6 text-center h-[calc(100%-2rem)] flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400/80 mb-2" />
                  <p className="text-sm font-medium text-white">You are all caught up!</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    As you take quizzes and study with the AI Tutor, smart recommendations will automatically appear here.
                  </p>
                </Card>
              )}
            </div>

            {/* Recent Activity Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-400" />
                  Recent Activity
                </h2>
                <span className="text-[11px] text-slate-400">Live events</span>
              </div>

              <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
                {recentActivity.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No recent activity yet. Upload materials or start a quiz to see your learning timeline.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {recentActivity.map((evt) => {
                      const meta = eventTypeMeta[evt.event_type] ?? {
                        label: evt.event_type.replace(/_/g, " "),
                        icon: Sparkles,
                        color: "text-slate-400 bg-slate-800",
                      };
                      const Icon = meta.icon;

                      return (
                        <div key={evt.id} className="flex items-start gap-3 text-xs group">
                          <div className={`p-1.5 rounded-lg shrink-0 ${meta.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                              {meta.label}
                            </p>
                            {evt.payload && typeof evt.payload === "object" && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {(evt.payload as any).file_name ||
                                  (evt.payload as any).topic ||
                                  (evt.payload as any).score !== undefined
                                  ? `Score: ${(evt.payload as any).score}%`
                                  : null}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeTime(evt.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
