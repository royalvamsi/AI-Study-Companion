"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Plus,
  FolderOpen,
  FileText,
  Loader2,
  ExternalLink,
  MessageSquare,
  ClipboardCheck,
  FolderKanban,
  Target,
  Layers,
  Sparkles,
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
    ready: "bg-emerald-50 text-emerald-800 border-emerald-200",
    processing: "bg-amber-50 text-amber-800 border-amber-200",
    queued: "bg-neutral-100 text-neutral-700 border-black/5",
    failed: "bg-rose-50 text-rose-800 border-rose-200",
  };

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  return (
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Spaces & Projects" },
        ]}
      />

      {/* Header & Space Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b hairline">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
              Organization
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight">
              Study Projects
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white border border-black/10 text-neutral-600 font-medium">
              {projects.length}
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-2 font-sans">
            {activeSpace
              ? `Filtered by space: ${activeSpace.name}`
              : "Manage all your study units, lecture materials, and AI study tools."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Space Filter */}
          {spaces.length > 0 && (
            <Select
              value={activeSpaceId ?? "all"}
              onValueChange={(v) => {
                const value = v ?? "all";
                router.push(value === "all" ? "/projects" : `/projects?space=${value}`);
              }}
            >
              <SelectTrigger className="w-44 bg-white border-black/10 text-neutral-800 text-xs h-9 px-3 rounded-xl shadow-xs cursor-pointer">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                <SelectValue placeholder="All spaces">
                  {(val: string | null) => {
                    const target = val || (activeSpaceId ?? "all");
                    if (!target || target === "all") return "All spaces";
                    const s = spaces.find((sp) => sp.id === target);
                    return s?.name ?? "All spaces";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-black/10 text-ink shadow-lg rounded-xl">
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
              className="inline-flex items-center justify-center rounded-xl bg-orange hover:bg-[#D44F19] disabled:opacity-50 text-white font-medium shadow-xs text-xs h-9 px-4 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Project
            </DialogTrigger>
            <DialogContent className="bg-white border border-black/10 text-ink max-w-md rounded-[24px] p-6 shadow-xl">
              <DialogHeader className="space-y-1">
                <DialogTitle className="display text-2xl font-bold text-ink">
                  Create a Study Project
                </DialogTitle>
                <DialogDescription className="text-neutral-500 text-xs leading-relaxed">
                  A project holds your PDF materials and powers your grounded AI Tutor and quizzes.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Assign to Space
                  </Label>
                  {spaces.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#F9F8F5] border border-black/5 text-neutral-600 text-xs flex items-center justify-between">
                      <span>No study spaces yet</span>
                      <Link
                        href="/dashboard"
                        className="text-orange hover:underline font-semibold"
                      >
                        Create Space
                      </Link>
                    </div>
                  ) : (
                    <Select
                      value={selectedSpaceId}
                      onValueChange={(v) => setSelectedSpaceId(v ?? "")}
                    >
                      <SelectTrigger className="bg-white border-black/15 text-ink text-xs h-10 rounded-xl">
                        <SelectValue placeholder="Select space">
                          {(val: string | null) => {
                            const targetId = val || selectedSpaceId;
                            if (!targetId) return "Select space";
                            const match = spaces.find((s) => s.id === targetId);
                            return match?.name ?? "Select space";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-black/10 text-ink shadow-lg rounded-xl">
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
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Project Name
                  </Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Chapter 4 — Neural Networks"
                    required
                    className="bg-white border-black/15 text-ink text-sm rounded-xl h-10 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Description (optional)
                  </Label>
                  <Textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Briefly describe what this study project covers..."
                    rows={2}
                    className="bg-white border-black/15 text-ink text-sm rounded-xl resize-none placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Learning Goal (optional)
                  </Label>
                  <Input
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                    placeholder="e.g., Master backpropagation and activation functions"
                    className="bg-white border-black/15 text-ink text-sm rounded-xl h-10 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-orange hover:bg-[#D44F19] text-white text-xs font-medium h-10 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Creating Project…
                    </>
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
          className="my-12 py-16 bg-white border border-black/10 rounded-[26px] subtle-shadow"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={activeSpace ? `No projects in "${activeSpace.name}"` : "No study projects yet"}
          description="Create your first study project to upload documents, chat with the grounded AI Tutor, and take adaptive quizzes."
          actionLabel="Create Project"
          onAction={() => setCreateOpen(true)}
          className="my-12 py-16 bg-white border border-black/10 rounded-[26px] subtle-shadow"
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
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow flex flex-col justify-between hover:border-black/20 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {projectSpace && (
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-600 font-medium">
                        <FolderKanban className="h-2.5 w-2.5 mr-1 text-neutral-400" />
                        {projectSpace.name}
                      </span>
                    )}
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-neutral-400 hover:text-ink transition-colors ml-auto"
                      title="Open Project"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-ink tracking-tight group-hover:text-orange transition-colors font-sans">
                      <Link href={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </h3>

                    {project.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mt-1">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Goal callout */}
                  {project.learning_goal && (
                    <p className="text-[11px] text-neutral-700 flex items-center gap-1.5 font-medium truncate pt-0.5">
                      <Target className="h-3 w-3 shrink-0 text-orange" />
                      <span className="truncate">{project.learning_goal}</span>
                    </p>
                  )}

                  {/* Stats line */}
                  <div className="flex items-center gap-4 text-xs text-neutral-500 pt-1 border-t hairline">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-neutral-400" />
                      <strong className="text-ink font-semibold">{readyCount}/{totalMaterials}</strong> {totalMaterials === 1 ? "doc" : "docs"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
                      <strong className="text-ink font-semibold">{conceptCount}</strong> {conceptCount === 1 ? "concept" : "concepts"}
                    </span>
                  </div>

                  {/* Material previews */}
                  {totalMaterials > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {project.materials.slice(0, 2).map((mat) => (
                        <span
                          key={mat.id}
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-medium truncate max-w-[180px] ${
                            statusColors[mat.status] ?? statusColors.queued
                          }`}
                        >
                          {mat.file_name}
                        </span>
                      ))}
                      {totalMaterials > 2 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#F5F3EE] border border-black/5 text-neutral-500">
                          +{totalMaterials - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Quick Actions */}
                <div className="pt-3 mt-4 border-t hairline flex items-center gap-2">
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button
                      size="sm"
                      className="w-full bg-ink hover:bg-neutral-800 text-white text-xs h-8 rounded-xl font-medium shadow-xs transition-colors cursor-pointer"
                    >
                      Open
                    </Button>
                  </Link>
                  <Link href={`/tutor?project=${project.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-8 px-2.5 rounded-xl font-medium cursor-pointer"
                      title="Open AI Tutor"
                    >
                      <MessageSquare className="h-3 w-3 mr-1 text-neutral-500" />
                      Tutor
                    </Button>
                  </Link>
                  <Link href={`/quiz?project=${project.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-8 px-2.5 rounded-xl font-medium cursor-pointer"
                      title="Start Quiz"
                    >
                      <ClipboardCheck className="h-3 w-3 mr-1 text-neutral-500" />
                      Quiz
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
