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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Plus,
  FolderOpen,
  FileText,
  Lightbulb,
  Loader2,
  ExternalLink,
  MessageSquare,
  ClipboardCheck,
  FolderKanban,
  Target,
  Clock,
  Layers,
} from "lucide-react";

interface Space {
  id: string;
  name: string;
}

interface Project {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  learning_goal: string | null;
  created_at: string;
  updated_at: string;
  materials: Array<{ id: string; file_name: string; status: string }>;
  concepts: Array<{ id: string }>;
}

interface ProjectsContentProps {
  userId: string;
  spaces: Space[];
  projects: Project[];
  activeSpaceId: string | null;
}

export function ProjectsContent({
  userId,
  spaces,
  projects,
  activeSpaceId,
}: ProjectsContentProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState(
    activeSpaceId ?? (spaces[0]?.id ?? "")
  );
  const [creating, setCreating] = useState(false);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || !selectedSpaceId) return;
    setCreating(true);

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("projects") as any)
        .insert({
          space_id: selectedSpaceId,
          user_id: userId,
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          learning_goal: projectGoal.trim() || null,
        })
        .select("id")
        .single();

      setCreateOpen(false);
      setProjectName("");
      setProjectDescription("");
      setProjectGoal("");

      if (data?.id) {
        router.push(`/projects/${data.id}`);
      } else {
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  const statusColors: Record<string, string> = {
    ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    processing: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    queued: "bg-slate-700/40 text-slate-300 border-slate-700",
    failed: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  };

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Spaces & Projects" },
        ]}
      />

      {/* Header & Space Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Study Projects
            </h1>
            <Badge variant="outline" className="bg-slate-800/80 text-slate-300 border-slate-700 text-xs">
              {projects.length}
            </Badge>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {activeSpace
              ? `Filtered by space: ${activeSpace.name}`
              : "Manage all your study units, lecture materials, and AI study tools."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Space Filter */}
          {spaces.length > 0 && (
            <Select
              value={activeSpaceId ?? "all"}
              onValueChange={(v) => {
                const value = v ?? "all";
                router.push(value === "all" ? "/projects" : `/projects?space=${value}`);
              }}
            >
              <SelectTrigger className="w-44 bg-slate-900/60 border-slate-700/80 text-slate-200 text-xs h-9">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="All spaces">
                  {(val: string | null) => {
                    const target = val || (activeSpaceId ?? "all");
                    if (!target || target === "all") return "All spaces";
                    const s = spaces.find((sp) => sp.id === target);
                    return s?.name ?? "All spaces";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="all">All spaces</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* New Project Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              disabled={spaces.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium shadow-sm text-xs h-9 px-3 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Project
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
              <DialogHeader>
                <DialogTitle>Create a Study Project</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  A project holds your PDF materials and powers your grounded AI Tutor and quizzes.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Assign to Space</Label>
                  {spaces.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-xs flex items-center justify-between">
                      <span>No study spaces yet</span>
                      <Link
                        href="/dashboard"
                        className="text-indigo-400 hover:text-indigo-300 font-medium underline"
                      >
                        Create Space
                      </Link>
                    </div>
                  ) : (
                    <Select
                      value={selectedSpaceId}
                      onValueChange={(v) => setSelectedSpaceId(v ?? "")}
                    >
                      <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white text-xs h-9">
                        <SelectValue placeholder="Select space">
                          {(val: string | null) => {
                            const targetId = val || selectedSpaceId;
                            if (!targetId) return "Select space";
                            const match = spaces.find((s) => s.id === targetId);
                            return match?.name ?? "Select space";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {spaces.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Project Name</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Chapter 4 — Neural Networks"
                    required
                    className="bg-slate-800/60 border-slate-700 text-white text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Description (optional)</Label>
                  <Textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Briefly describe what this study project covers..."
                    rows={2}
                    className="bg-slate-800/60 border-slate-700 text-white text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Learning Goal (optional)</Label>
                  <Input
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                    placeholder="e.g., Master backpropagation and activation functions"
                    className="bg-slate-800/60 border-slate-700 text-white text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
                >
                  {creating ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Creating Project…</>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Projects Grid / Empty States */}
      {spaces.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Create a study space first"
          description="Projects belong inside study spaces. Go to the dashboard to create your first space."
          actionLabel="Go to Dashboard"
          actionHref="/dashboard"
          className="my-12 py-16"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={activeSpace ? `No projects in "${activeSpace.name}"` : "No study projects yet"}
          description="Create your first study project to upload documents, chat with the grounded AI Tutor, and take adaptive quizzes."
          actionLabel="Create Project"
          onAction={() => setCreateOpen(true)}
          className="my-12 py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const readyCount =
              project.materials?.filter((m) => m.status === "ready").length ?? 0;
            const totalMaterials = project.materials?.length ?? 0;
            const conceptCount = project.concepts?.length ?? 0;
            const projectSpace = spaces.find((s) => s.id === project.space_id);

            return (
              <Card
                key={project.id}
                className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-indigo-500/40 transition-colors flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <CardHeader className="p-4 pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      {projectSpace && (
                        <Badge
                          variant="outline"
                          className="bg-slate-800/80 text-slate-300 border-slate-700/80 text-[10px]"
                        >
                          <FolderKanban className="h-2.5 w-2.5 mr-1 text-slate-400" />
                          {projectSpace.name}
                        </Badge>
                      )}
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-slate-400 hover:text-indigo-400 transition-colors"
                        title="Open Project"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>

                    <CardTitle className="text-base font-semibold text-white tracking-tight group-hover:text-indigo-200 transition-colors">
                      <Link href={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </CardTitle>

                    {project.description && (
                      <CardDescription className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3">
                    {/* Goal badge */}
                    {project.learning_goal && (
                      <p className="text-[11px] text-indigo-300/90 flex items-center gap-1.5 font-medium truncate">
                        <Target className="h-3 w-3 shrink-0 text-indigo-400" />
                        <span className="truncate">{project.learning_goal}</span>
                      </p>
                    )}

                    {/* Stats pills */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        {readyCount}/{totalMaterials} {totalMaterials === 1 ? "doc" : "docs"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                        {conceptCount} {conceptCount === 1 ? "concept" : "concepts"}
                      </span>
                    </div>

                    {/* Material previews */}
                    {totalMaterials > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {project.materials.slice(0, 2).map((mat) => (
                          <Badge
                            key={mat.id}
                            variant="outline"
                            className={`text-[10px] ${
                              statusColors[mat.status] ?? statusColors.queued
                            }`}
                          >
                            {mat.file_name.length > 20
                              ? mat.file_name.slice(0, 18) + "…"
                              : mat.file_name}
                          </Badge>
                        ))}
                        {totalMaterials > 2 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-slate-800 text-slate-400 border-slate-700"
                          >
                            +{totalMaterials - 2} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Footer Quick Actions */}
                <div className="p-3 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-2">
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs h-7.5"
                    >
                      Open
                    </Button>
                  </Link>
                  <Link href={`/tutor?project=${project.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs h-7.5 px-2.5"
                      title="Open AI Tutor"
                    >
                      <MessageSquare className="h-3 w-3 mr-1 text-indigo-400" />
                      Tutor
                    </Button>
                  </Link>
                  <Link href={`/quiz?project=${project.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs h-7.5 px-2.5"
                      title="Start Quiz"
                    >
                      <ClipboardCheck className="h-3 w-3 mr-1 text-emerald-400" />
                      Quiz
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
