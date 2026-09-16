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
import {
  Plus,
  FolderOpen,
  FileText,
  Lightbulb,
  Loader2,
  ExternalLink,
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
  const [selectedSpaceId, setSelectedSpaceId] = useState(activeSpaceId ?? (spaces[0]?.id ?? ""));
  const [creating, setCreating] = useState(false);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || !selectedSpaceId) return;
    setCreating(true);

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("projects") as any).insert({
        space_id: selectedSpaceId,
        user_id: userId,
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        learning_goal: projectGoal.trim() || null,
      }).select("id").single();

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
    ready: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    processing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    queued: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Projects
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
            {activeSpaceId ? ` in ${spaces.find((s) => s.id === activeSpaceId)?.name ?? "this space"}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Space filter */}
          <Select
            value={activeSpaceId ?? "all"}
            onValueChange={(v) => {
              const value = v ?? "all";
              router.push(value === "all" ? "/projects" : `/projects?space=${value}`);
            }}
          >
            <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-slate-300">
              <SelectValue placeholder="All spaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All spaces</SelectItem>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger>
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                disabled={spaces.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Create a new project</DialogTitle>
                <DialogDescription className="text-slate-400">
                  A project is a focused study unit — upload materials and learn with AI.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Space</Label>
                  <Select value={selectedSpaceId} onValueChange={(v) => setSelectedSpaceId(v ?? "")}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {spaces.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Project name</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Chapter 5 — Cell Division"
                    required
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Description (optional)</Label>
                  <Textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="What will you study in this project?"
                    rows={2}
                    className="bg-slate-800/50 border-slate-700 text-white resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Learning goal (optional)</Label>
                  <Input
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                    placeholder="e.g., Understand mitosis vs meiosis"
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Projects grid */}
      {spaces.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-semibold text-white mb-1">
              Create a space first
            </h3>
            <p className="text-slate-400 text-sm max-w-md mb-4">
              Go to the Dashboard to create a space, then come back here to add projects.
            </p>
            <Button variant="outline">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 mb-4">
              <FolderOpen className="h-7 w-7 text-indigo-400/60" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              No projects yet
            </h3>
            <p className="text-slate-400 text-sm max-w-md mb-4">
              Create your first project to start uploading study materials and learning with AI.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const readyCount = project.materials?.filter((m) => m.status === "ready").length ?? 0;
            const totalMaterials = project.materials?.length ?? 0;
            const conceptCount = project.concepts?.length ?? 0;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="bg-slate-900/50 border-slate-800/60 hover:border-indigo-500/30 transition-all duration-200 cursor-pointer group h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-white text-base font-semibold group-hover:text-indigo-300 transition-colors">
                        {project.name}
                      </CardTitle>
                      <ExternalLink className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                    </div>
                    {project.description && (
                      <CardDescription className="text-slate-500 text-sm line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {readyCount}/{totalMaterials} materials
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" />
                        {conceptCount} concepts
                      </span>
                    </div>

                    {/* Material status badges */}
                    {totalMaterials > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {project.materials.slice(0, 3).map((mat) => (
                          <Badge
                            key={mat.id}
                            variant="outline"
                            className={`text-[10px] ${statusColors[mat.status] ?? statusColors.queued}`}
                          >
                            {mat.file_name.length > 20
                              ? mat.file_name.slice(0, 18) + "…"
                              : mat.file_name}
                          </Badge>
                        ))}
                        {totalMaterials > 3 && (
                          <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-500 border-slate-700">
                            +{totalMaterials - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {project.learning_goal && (
                      <p className="text-xs text-slate-600 italic truncate">
                        🎯 {project.learning_goal}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
