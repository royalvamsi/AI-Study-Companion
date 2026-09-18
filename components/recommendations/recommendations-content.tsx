"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Lightbulb,
  Sparkles,
  CheckCircle2,
  Brain,
  ClipboardCheck,
  Filter,
  Check,
  RotateCcw,
  MessageSquare,
  ArrowRight,
  Target,
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
  status?: "active" | "superseded" | "resolved";
  updated_at?: string;
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
  const [recommendations, setRecommendations] =
    useState<RecommendationItem[]>(initialRecommendations);
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function toggleDismiss(recId: string, currentDismissed: boolean) {
    setUpdatingId(recId);
    const supabase = createClient();
    const nextState = !currentDismissed;
    const nextStatus = nextState ? ("resolved" as const) : ("active" as const);
    const now = new Date().toISOString();

    // Optimistic UI update
    setRecommendations((prev) =>
      prev.map((r) =>
        r.id === recId
          ? { ...r, is_dismissed: nextState, status: nextStatus, updated_at: now }
          : r
      )
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("recommendations")
        .update({
          is_dismissed: nextState,
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", recId);
    } catch (err) {
      console.error("Failed to update recommendation:", err);
      // Revert on error
      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === recId ? { ...r, is_dismissed: currentDismissed } : r
        )
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = recommendations.filter((r) => {
    if (!showDismissed) {
      if (r.is_dismissed || (r.status && r.status !== "active")) return false;
    } else {
      if (!r.is_dismissed && r.status !== "resolved") return false;
    }
    if (selectedProject !== "ALL" && r.project_id !== selectedProject)
      return false;
    if (selectedPriority !== "ALL" && r.priority !== selectedPriority)
      return false;
    return true;
  });

  const priorityColors = {
    HIGH: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    LOW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };

  const priorityBadges = {
    HIGH: "High Priority",
    MEDIUM: "Medium Priority",
    LOW: "Suggestion",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Study Recommendations" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Study Recommendations
            </h1>
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-400 border-amber-500/25 text-xs"
            >
              Adaptive Guidance
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Actionable next steps generated from your concept mastery and quiz evaluations.
          </p>
        </div>

        {/* Dismissed toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDismissed(!showDismissed)}
            className={`border-slate-700 text-xs h-9 ${
              showDismissed
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-white"
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
                View Completed
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 px-1">
          <Filter className="h-3.5 w-3.5 text-indigo-400" />
          Filter:
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
          Showing <span className="font-semibold text-white">{filtered.length}</span>{" "}
          item{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={showDismissed ? "No completed items" : "You're all caught up"}
          description={
            showDismissed
              ? "Items you complete or dismiss will appear here for historical reference."
              : "As you complete adaptive quizzes and converse with the AI Tutor, personalized recommendations will automatically populate here."
          }
          className="my-12 py-16"
        >
          {!showDismissed && (
            <div className="flex justify-center gap-3 pt-4">
              <Link href="/quiz">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Take a Quiz
                </Button>
              </Link>
              <Link href="/tutor">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-800/80 text-slate-200 text-xs h-8 px-4"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Open AI Tutor
                </Button>
              </Link>
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rec) => {
            const projectName = rec.projects?.name ?? "Unknown Project";
            const conceptName = rec.concepts?.name;

            return (
              <Card
                key={rec.id}
                className={`border-slate-800/80 bg-slate-900/60 backdrop-blur-sm transition-all hover:border-slate-700 ${
                  rec.is_dismissed ? "opacity-60" : ""
                } flex flex-col justify-between`}
              >
                <CardHeader className="p-5 pb-3 space-y-2.5">
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
                      <Badge
                        variant="outline"
                        className="bg-slate-800/80 text-slate-300 border-slate-700/80 text-[10px]"
                      >
                        {rec.action_type.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDismiss(rec.id, rec.is_dismissed)}
                      disabled={updatingId === rec.id}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title={rec.is_dismissed ? "Restore" : "Mark as completed"}
                      aria-label={rec.is_dismissed ? "Restore" : "Mark as completed"}
                    >
                      {rec.is_dismissed ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 hover:text-emerald-400 transition-colors" />
                      )}
                    </Button>
                  </div>

                  <CardTitle className="text-sm sm:text-base font-semibold text-white leading-snug">
                    {conceptName ? `Strengthen: ${conceptName}` : `Review: ${projectName}`}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {rec.reasoning && (
                    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-slate-200 block mb-1">
                        Why this is recommended:
                      </span>
                      {rec.reasoning}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/50 text-xs">
                    <span className="text-slate-400 truncate max-w-[200px]">
                      Project: <span className="text-slate-300 font-medium">{projectName}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <Link href={`/tutor?project=${rec.project_id}`}>
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3 shadow-sm"
                        >
                          <MessageSquare className="h-3 w-3 mr-1.5" />
                          Study with Tutor
                        </Button>
                      </Link>
                      <Link href={`/quiz?project=${rec.project_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs h-8 px-3"
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1.5 text-emerald-400" />
                          Quiz
                        </Button>
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
