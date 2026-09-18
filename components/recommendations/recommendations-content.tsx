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
    HIGH: "bg-rose-50 text-rose-700 border-rose-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-stone-100 text-stone-700 border-stone-200",
  };

  const priorityBadges = {
    HIGH: "High Priority",
    MEDIUM: "Recommended",
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-black/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E85D24]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Adaptive Guidance
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Study Recommendations
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Actionable next steps generated from your concept mastery and quiz evaluations.
          </p>
        </div>

        {/* Dismissed toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDismissed(!showDismissed)}
            className={`border-black/10 text-xs h-9 rounded-lg transition-colors ${
              showDismissed
                ? "bg-[#171717] text-white hover:bg-black"
                : "bg-white text-[#171717] hover:bg-neutral-50"
            }`}
          >
            {showDismissed ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                Viewing Completed ({recommendations.filter((r) => r.is_dismissed).length})
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
                View Completed
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-black/10 p-3.5 rounded-xl shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 px-1">
          <Filter className="h-3.5 w-3.5 text-[#E85D24]" />
          Filter:
        </div>

        {/* Project Selector */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-[#F5F3EE] border border-black/10 text-xs text-[#171717] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
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
          className="bg-[#F5F3EE] border border-black/10 text-xs text-[#171717] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
        >
          <option value="ALL">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Recommended</option>
          <option value="LOW">Suggestions</option>
        </select>

        <div className="ml-auto text-xs text-neutral-500">
          Showing <span className="font-semibold text-[#171717]">{filtered.length}</span>{" "}
          item{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-xl p-12 text-center shadow-sm my-6">
          <div className="w-12 h-12 rounded-full bg-[#F5F3EE] border border-black/10 flex items-center justify-center mx-auto mb-4 text-[#E85D24]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-serif text-xl text-[#171717] mb-2 font-normal">
            {showDismissed ? "No completed items" : "You're all caught up"}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
            {showDismissed
              ? "Items you complete or dismiss will appear here for historical reference."
              : "As you complete adaptive quizzes and converse with the AI Tutor, personalized recommendations will automatically populate here."}
          </p>
          {!showDismissed && (
            <div className="flex justify-center gap-3 pt-6">
              <Link href="/quiz">
                <Button
                  size="sm"
                  className="bg-[#E85D24] hover:bg-[#d04e1b] text-white text-xs h-8 px-4 rounded-lg shadow-sm font-medium"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Take a Quiz
                </Button>
              </Link>
              <Link href="/tutor">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-black/10 bg-white hover:bg-neutral-50 text-[#171717] text-xs h-8 px-4 rounded-lg font-medium"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Open AI Tutor
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rec) => {
            const projectName = rec.projects?.name ?? "Unknown Project";
            const conceptName = rec.concepts?.name;

            return (
              <Card
                key={rec.id}
                className={`border-black/10 bg-white shadow-sm transition-all hover:border-black/20 hover:shadow-md rounded-xl ${
                  rec.is_dismissed ? "opacity-60 bg-stone-50/70" : ""
                } flex flex-col justify-between`}
              >
                <CardHeader className="p-5 pb-3 space-y-3">
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
                        className="bg-[#F5F3EE] text-neutral-600 border-black/10 text-[10px]"
                      >
                        {rec.action_type.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDismiss(rec.id, rec.is_dismissed)}
                      disabled={updatingId === rec.id}
                      className="h-7 w-7 p-0 text-neutral-400 hover:text-[#171717] hover:bg-stone-100 rounded-md"
                      title={rec.is_dismissed ? "Restore" : "Mark as completed"}
                      aria-label={rec.is_dismissed ? "Restore" : "Mark as completed"}
                    >
                      {rec.is_dismissed ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 hover:text-emerald-600 transition-colors" />
                      )}
                    </Button>
                  </div>

                  <CardTitle className="font-serif text-lg sm:text-xl font-normal text-[#171717] leading-snug">
                    {conceptName ? `Strengthen: ${conceptName}` : `Review: ${projectName}`}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {rec.reasoning && (
                    <div className="p-3.5 rounded-lg bg-[#F5F3EE] border-l-2 border-[#E85D24] text-xs text-neutral-700 leading-relaxed">
                      <span className="font-medium text-[#171717] block mb-1">
                        Why this is recommended:
                      </span>
                      {rec.reasoning}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-black/5 text-xs">
                    <span className="text-neutral-500 truncate max-w-[200px]">
                      Project: <span className="text-[#171717] font-medium">{projectName}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <Link href={`/tutor?project=${rec.project_id}`}>
                        <Button
                          size="sm"
                          className="bg-[#E85D24] hover:bg-[#d04e1b] text-white text-xs h-8 px-3.5 rounded-lg shadow-sm font-medium"
                        >
                          <MessageSquare className="h-3 w-3 mr-1.5" />
                          Study with Tutor
                        </Button>
                      </Link>
                      <Link href={`/quiz?project=${rec.project_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-black/10 bg-white hover:bg-neutral-50 text-[#171717] text-xs h-8 px-3 rounded-lg font-medium"
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1.5 text-emerald-600" />
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
