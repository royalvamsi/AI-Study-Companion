"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  AlertTriangle,
  Sparkles,
  ClipboardCheck,
  MessageSquare,
  BarChart3,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";

interface MasteryRecord {
  project_id: string;
  concept_id: string;
  mastery_score: number;
  trend: string | null;
  assessment_count: number;
  concepts: { name: string } | null;
}

interface GrowthContentProps {
  projects: Array<{ id: string; name: string }>;
  mastery: MasteryRecord[];
  narrative?: string | null;
}

const trendConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  IMPROVING: {
    icon: TrendingUp,
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    label: "Improving",
  },
  NEEDS_ATTENTION: {
    icon: TrendingDown,
    color: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    label: "Needs Attention",
  },
  STABLE: {
    icon: Minus,
    color: "bg-slate-700/40 text-slate-300 border-slate-700",
    label: "Stable",
  },
};

function getBarColor(score: number): string {
  if (score >= 80) return "#34d399"; // emerald
  if (score >= 60) return "#60a5fa"; // blue
  if (score >= 40) return "#fbbf24"; // amber
  return "#f87171"; // rose
}

export function GrowthContent({ projects, mastery, narrative }: GrowthContentProps) {
  const [filterProject, setFilterProject] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMastery = mastery.filter((m) => {
    if (filterProject !== "ALL" && m.project_id !== filterProject) return false;
    if (
      searchQuery &&
      !m.concepts?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const improving = mastery.filter((m) => m.trend === "IMPROVING");
  const needsAttention = mastery.filter((m) => m.trend === "NEEDS_ATTENTION");
  const stable = mastery.filter((m) => m.trend === "STABLE");

  const avgMastery =
    mastery.length > 0
      ? Math.round(
          mastery.reduce((sum, m) => sum + m.mastery_score, 0) / mastery.length
        )
      : 0;

  // Prepare chart data (top concepts by score or assessment)
  const chartData = filteredMastery.slice(0, 12).map((m) => {
    const rawName = m.concepts?.name ?? "Unknown";
    return {
      name: rawName.length > 14 ? rawName.slice(0, 13) + "…" : rawName,
      fullName: rawName,
      score: Math.round(m.mastery_score),
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Growth & Mastery" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Learning Growth & Mastery
            </h1>
            <Badge
              variant="outline"
              className="bg-indigo-500/10 text-indigo-300 border-indigo-500/25 text-xs"
            >
              Adaptive Tracking
            </Badge>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Track how your conceptual understanding evolves through quizzes and study sessions.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="bg-slate-800/70 border border-slate-700/80 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mastery.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No mastery data recorded yet"
          description="Complete adaptive quizzes to start tracking your mastery across individual concepts and see your learning trajectory."
          actionLabel="Take a Quiz"
          actionHref="/quiz"
          className="my-12 py-16"
        />
      ) : (
        <>
          {/* Section 3: AI Coach Growth Narrative Banner */}
          {narrative && (
            <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-900/40 p-4 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                      Coach Growth Narrative
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] py-0"
                    >
                      AI Summary
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed font-normal">
                    {narrative}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Summary KPI Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Overall Mastery */}
            <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">Overall Mastery</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Target className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {avgMastery}%
              </div>
              <p className="text-[11px] text-slate-400">Average across concepts</p>
            </Card>

            {/* Concepts Tracked */}
            <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">Concepts Tracked</span>
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                  <Brain className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {mastery.length}
              </div>
              <p className="text-[11px] text-slate-400">Indexed from materials</p>
            </Card>

            {/* Improving Concepts */}
            <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">Improving</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-300 tracking-tight">
                {improving.length}
              </div>
              <p className="text-[11px] text-slate-400">Upward mastery trend</p>
            </Card>

            {/* Needs Attention */}
            <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">Needs Attention</span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-300 tracking-tight">
                {needsAttention.length}
              </div>
              <p className="text-[11px] text-slate-400">Require additional review</p>
            </Card>
          </div>

          {/* Recharts Bar Chart */}
          {chartData.length > 0 && (
            <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                  Concept Mastery Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, bottom: 40, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "10px",
                          color: "#f8fafc",
                          fontSize: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                        }}
                        formatter={(value: any) => [`${value}%`, "Mastery Score"]}
                        labelFormatter={(label: any) => {
                          const match = chartData.find((d) => d.name === label);
                          return match?.fullName ?? String(label);
                        }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Concept Cards */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Concept Breakdown ({filteredMastery.length})
              </h3>
              <div className="relative max-w-xs w-full">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMastery.map((m) => {
                const cfg =
                  trendConfig[m.trend ?? "STABLE"] ?? trendConfig.STABLE;
                const TrendIcon = cfg.icon;
                const projectName =
                  projects.find((p) => p.id === m.project_id)?.name ?? "Project";

                return (
                  <Card
                    key={m.concept_id}
                    className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4 space-y-3 hover:border-slate-700/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {m.concepts?.name ?? "Unnamed Concept"}
                        </h4>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          In: {projectName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium py-0.5 ${cfg.color}`}
                        >
                          <TrendIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-sm font-bold text-white">
                          {m.mastery_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <Progress
                      value={m.mastery_score}
                      className="h-1.5 bg-slate-800"
                    />

                    <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
                      <span className="text-[11px]">
                        {m.assessment_count} test{m.assessment_count !== 1 ? "s" : ""} completed
                      </span>
                      <div className="flex items-center gap-2">
                        <Link href={`/tutor?project=${m.project_id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2"
                          >
                            <MessageSquare className="h-2.5 w-2.5 mr-1" />
                            Study
                          </Button>
                        </Link>
                        <Link href={`/quiz?project=${m.project_id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2"
                          >
                            <ClipboardCheck className="h-2.5 w-2.5 mr-1" />
                            Quiz
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
