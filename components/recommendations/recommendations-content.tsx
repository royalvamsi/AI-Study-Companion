"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Sparkles,
  CheckCircle2,
  Brain,
  ClipboardCheck,
  Filter,
  Check,
  RotateCcw,
} from "lucide-react";

interface RecommendationItem {
  id: string;
  project_id: string;
  user_id: string;
  concept_id: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  action_type: string;
  reasoning: string | null;
  is_dismissed: boolean;
  created_at: string;
  projects?: { id: string; name: string } | null;
  concepts?: { id: string; name: string } | null;
}

interface RecommendationsContentProps {
  initialRecommendations: RecommendationItem[];
  projects: { id: string; name: string }[];
  userId: string;
}

export function RecommendationsContent({
  initialRecommendations,
  projects,
}: RecommendationsContentProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(initialRecommendations);
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function toggleDismiss(recId: string, currentDismissed: boolean) {
    setUpdatingId(recId);
    const supabase = createClient();
    const nextState = !currentDismissed;

    // Optimistic UI update
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, is_dismissed: nextState } : r))
    );

    try {
      await (supabase as any)
        .from("recommendations")
        .update({ is_dismissed: nextState })
        .eq("id", recId);
    } catch (err) {
      console.error("Failed to update recommendation:", err);
      // Revert on error
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, is_dismissed: currentDismissed } : r))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = recommendations.filter((r) => {
    if (!showDismissed && r.is_dismissed) return false;
    if (showDismissed && !r.is_dismissed) return false;
    if (selectedProject !== "ALL" && r.project_id !== selectedProject) return false;
    if (selectedPriority !== "ALL" && r.priority !== selectedPriority) return false;
    return true;
  });

  const priorityColors = {
    HIGH: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    LOW: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };

  const priorityBadges = {
    HIGH: "High Priority",
    MEDIUM: "Medium Priority",
    LOW: "Suggestion",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Lightbulb className="h-6 w-6 text-amber-400" />
            Study Recommendations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic and AI-driven study tasks based on your quiz performance and concept mastery.
          </p>
        </div>

        {/* Dismissed toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDismissed(!showDismissed)}
            className={`border-slate-700 text-xs ${
              showDismissed ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            {showDismissed ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                Viewing Completed ({recommendations.filter((r) => r.is_dismissed).length})
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                View Completed/Dismissed
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 px-1">
          <Filter className="h-3.5 w-3.5 text-indigo-400" />
          Filter by:
        </div>

        {/* Project Selector */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All Projects ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Priority Selector */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Suggestions</option>
        </select>

        <div className="ml-auto text-xs text-slate-400">
          Showing <span className="font-semibold text-white">{filtered.length}</span> item{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Recommendations List */}
      {filtered.length === 0 ? (
        <Card className="border-slate-800/80 bg-slate-900/40 text-center py-16">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">
                {showDismissed ? "No completed items" : "No recommendations right now"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {showDismissed
                  ? "Items you dismiss or complete will appear here for reference."
                  : "As you take quizzes and study with the AI Tutor, your personalized recommendations will appear here automatically."}
              </p>
            </div>
            {!showDismissed && (
              <div className="flex justify-center gap-3 pt-2">
                <Link
                  href="/quiz"
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white h-8 px-3 transition-colors"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Take a Quiz
                </Link>
                <Link
                  href="/tutor"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white h-8 px-3 transition-colors"
                >
                  <Brain className="h-3.5 w-3.5 mr-1.5" />
                  Open AI Tutor
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rec) => {
            const projectName = rec.projects?.name ?? "Unknown Project";
            const conceptName = rec.concepts?.name;

            return (
              <Card
                key={rec.id}
                className={`border-slate-800/80 bg-slate-900/50 backdrop-blur-sm transition-all hover:border-slate-700/80 ${
                  rec.is_dismissed ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          priorityColors[rec.priority] ?? priorityColors.LOW
                        }`}
                      >
                        {priorityBadges[rec.priority] ?? rec.priority}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-800/60 text-slate-300 border-slate-700/60 text-[10px]">
                        {rec.action_type.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDismiss(rec.id, rec.is_dismissed)}
                      disabled={updatingId === rec.id}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title={rec.is_dismissed ? "Restore" : "Dismiss"}
                    >
                      {rec.is_dismissed ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 hover:text-emerald-400 transition-colors" />
                      )}
                    </Button>
                  </div>

                  <CardTitle className="text-sm font-semibold text-white leading-snug">
                    {conceptName ? `Strengthen: ${conceptName}` : `Study: ${projectName}`}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  {rec.reasoning && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/60">
                      {rec.reasoning}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-xs">
                    <span className="text-slate-400 truncate max-w-[180px]">
                      Project: <span className="text-slate-300">{projectName}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tutor?project=${rec.project_id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-medium text-white h-7 px-2.5 transition-colors"
                      >
                        <Brain className="h-3 w-3 mr-1" />
                        Study
                      </Link>
                      <Link
                        href={`/quiz?project=${rec.project_id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-700 hover:bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white h-7 px-2.5 transition-colors"
                      >
                        <ClipboardCheck className="h-3 w-3 mr-1" />
                        Quiz
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
