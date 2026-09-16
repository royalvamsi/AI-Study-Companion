"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Plus,
  FolderKanban,
  Clock,
  FileText,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface Space {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  }>;
}

interface ActivityEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface DashboardContentProps {
  userId: string;
  spaces: Space[];
  recentActivity: ActivityEvent[];
}

const eventTypeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  MATERIAL_READY: { label: "Material processed", icon: FileText, color: "text-emerald-400" },
  MATERIAL_PROCESSING: { label: "Processing material", icon: FileText, color: "text-amber-400" },
  TUTOR_MESSAGE: { label: "Tutor conversation", icon: MessageSquare, color: "text-indigo-400" },
  QUIZ_COMPLETED: { label: "Quiz completed", icon: ClipboardCheck, color: "text-violet-400" },
  MASTERY_UPDATED: { label: "Mastery updated", icon: TrendingUp, color: "text-cyan-400" },
  RECOMMENDATION_CREATED: { label: "New recommendation", icon: TrendingUp, color: "text-rose-400" },
};

export function DashboardContent({
  userId,
  spaces,
  recentActivity,
}: DashboardContentProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!spaceName.trim()) return;
    setCreating(true);

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("spaces") as any).insert({
        user_id: userId,
        name: spaceName.trim(),
        description: spaceDescription.trim() || null,
      });

      setCreateOpen(false);
      setSpaceName("");
      setSpaceDescription("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  const totalProjects = spaces.reduce(
    (sum, s) => sum + (s.projects?.length ?? 0),
    0
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {spaces.length} space{spaces.length !== 1 ? "s" : ""} · {totalProjects} project{totalProjects !== 1 ? "s" : ""}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
              <Plus className="h-4 w-4 mr-2" />
              New Space
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Create a new space</DialogTitle>
              <DialogDescription className="text-slate-400">
                Spaces group related projects together — e.g., "Biology 101" or "Machine Learning".
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSpace} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Name</Label>
                <Input
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  required
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Description (optional)</Label>
                <Textarea
                  value={spaceDescription}
                  onChange={(e) => setSpaceDescription(e.target.value)}
                  placeholder="What is this space about?"
                  rows={2}
                  className="bg-slate-800/50 border-slate-700 text-white resize-none"
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
                  "Create Space"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Spaces grid */}
      {spaces.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 mb-4">
              <FolderKanban className="h-7 w-7 text-indigo-400/60" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">
              No spaces yet
            </h3>
            <p className="text-slate-400 text-sm max-w-md mb-4">
              Create your first space to start organizing your study materials and projects.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first space
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => (
            <Card
              key={space.id}
              className="bg-slate-900/50 border-slate-800/60 hover:border-indigo-500/30 transition-all duration-200 cursor-pointer group"
              onClick={() => router.push(`/projects?space=${space.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-base font-semibold group-hover:text-indigo-300 transition-colors">
                    {space.name}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-slate-800 text-slate-400 text-xs"
                  >
                    {space.projects?.length ?? 0} project{(space.projects?.length ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {space.description && (
                  <CardDescription className="text-slate-500 text-sm line-clamp-2">
                    {space.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {space.projects?.length > 0 ? (
                  <div className="space-y-1.5">
                    {space.projects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-2 text-sm text-slate-400"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                        <span className="truncate">{project.name}</span>
                      </div>
                    ))}
                    {space.projects.length > 3 && (
                      <p className="text-xs text-slate-600 pl-3.5">
                        +{space.projects.length - 3} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic">No projects yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-slate-500" />
            Recent Activity
          </h2>
          <Card className="bg-slate-900/50 border-slate-800/60">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/50">
                {recentActivity.map((event) => {
                  const meta = eventTypeLabels[event.event_type] ?? {
                    label: event.event_type,
                    icon: Clock,
                    color: "text-slate-400",
                  };
                  const Icon = meta.icon;

                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${meta.color}`} />
                      <span className="text-sm text-slate-300 flex-1">
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-600">
                        {formatTimeAgo(event.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
