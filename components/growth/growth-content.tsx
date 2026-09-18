"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Improving",
  },
  NEEDS_ATTENTION: {
    icon: TrendingDown,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    label: "Needs Attention",
  },
  STABLE: {
    icon: Minus,
    color: "bg-[#F5F3EE] text-neutral-600 border-black/10",
    label: "Stable",
  },
};

function getBarColor(score: number): string {
  if (score >= 80) return "#10b981"; // emerald
  if (score >= 60) return "#E85D24"; // orange
  if (score >= 40) return "#f59e0b"; // amber
  return "#ef4444"; // rose
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-black/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E85D24]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 font-sans">
              Analytics & Mastery
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#171717] tracking-tight leading-tight">
              Learning Growth & Mastery
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white border border-black/10 text-neutral-600 font-medium font-sans">
              Adaptive Tracking
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl leading-relaxed font-sans">
            Track how your conceptual understanding evolves through quizzes and study sessions.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="bg-white border border-black/10 text-xs text-[#171717] rounded-xl px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#E85D24] shadow-xs cursor-pointer font-sans"
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
        /* Bespoke Editorial Empty State - Consistent with Dashboard / Recommendations */
        <div className="bg-white border border-black/10 rounded-2xl p-10 sm:p-16 my-8 text-center shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="w-12 h-12 rounded-full bg-[#F5F3EE] border border-black/10 flex items-center justify-center mx-auto text-[#171717]">
            <Target className="h-5 w-5 text-[#E85D24]" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#171717] tracking-tight">
              No mastery data recorded yet
            </h2>
            <p className="text-sm text-neutral-500 leading-relaxed font-sans">
              Complete adaptive quizzes to start tracking your mastery across individual concepts and see your learning trajectory.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/quiz">
              <Button
                className="bg-[#E85D24] hover:bg-[#d04e1b] text-white text-sm font-medium h-10 px-6 rounded-full shadow-sm transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
              >
                <ClipboardCheck className="h-4 w-4" />
                Take a Quiz
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* AI Coach Growth Narrative Banner */}
          {narrative && (
            <div className="bg-white rounded-2xl border border-black/10 p-6 sm:p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#F5F3EE] border border-black/10 text-[#E85D24] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Coach Growth Narrative
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed font-sans font-normal">
                    {narrative}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary KPI Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Overall Mastery */}
            <div className="bg-white rounded-2xl border border-black/10 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold">Overall Mastery</span>
                <div className="p-1.5 rounded-lg bg-[#F5F3EE] text-[#E85D24]">
                  <Target className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight mt-2">
                {avgMastery}%
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 font-sans">Across concepts</p>
            </div>

            {/* Concepts Tracked */}
            <div className="bg-white rounded-2xl border border-black/10 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold">Concepts Tracked</span>
                <div className="p-1.5 rounded-lg bg-[#F5F3EE] text-[#E85D24]">
                  <Brain className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight mt-2">
                {mastery.length}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 font-sans">Indexed from materials</p>
            </div>

            {/* Improving Concepts */}
            <div className="bg-white rounded-2xl border border-black/10 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold">Improving</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-3xl sm:text-4xl font-normal text-emerald-700 tracking-tight mt-2">
                {improving.length}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 font-sans">Upward mastery trend</p>
            </div>

            {/* Needs Attention */}
            <div className="bg-white rounded-2xl border border-black/10 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold">Needs Attention</span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-3xl sm:text-4xl font-normal text-rose-700 tracking-tight mt-2">
                {needsAttention.length}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 font-sans">Require review</p>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#E85D24]" />
                <h3 className="font-serif text-xl font-normal text-[#171717]">
                  Concept Mastery Overview
                </h3>
              </div>
              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, bottom: 40, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#737373", fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#737373", fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "rgba(0,0,0,0.1)",
                        borderRadius: "8px",
                        color: "#171717",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
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
            </div>
          )}

          {/* Individual Concept Cards */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D24]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 font-sans">
                  Concept Breakdown ({filteredMastery.length})
                </h3>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filter concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-black/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#E85D24] shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMastery.map((m) => {
                const cfg =
                  trendConfig[m.trend ?? "STABLE"] ?? trendConfig.STABLE;
                const TrendIcon = cfg.icon;
                const projectName =
                  projects.find((p) => p.id === m.project_id)?.name ?? "Project";

                return (
                  <div
                    key={m.concept_id}
                    className="bg-white rounded-2xl border border-black/10 p-5 shadow-sm space-y-3 hover:border-black/20 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[#171717] truncate font-sans">
                          {m.concepts?.name ?? "Unnamed Concept"}
                        </h4>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          In: {projectName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center text-[10px] font-medium py-0.5 px-2 rounded-full border ${cfg.color}`}
                        >
                          <TrendIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </span>
                        <span className="font-serif text-lg font-normal text-[#171717]">
                          {m.mastery_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full bg-[#171717] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, m.mastery_score))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-black/5 text-neutral-500">
                      <span className="text-[11px]">
                        {m.assessment_count} test{m.assessment_count !== 1 ? "s" : ""} completed
                      </span>
                      <div className="flex items-center gap-2">
                        <Link href={`/tutor?project=${m.project_id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] border-black/10 bg-white hover:bg-neutral-50 text-[#171717] px-2.5 rounded-lg cursor-pointer"
                          >
                            <MessageSquare className="h-3 w-3 mr-1 text-neutral-500" />
                            Study
                          </Button>
                        </Link>
                        <Link href={`/quiz?project=${m.project_id}`}>
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-[#E85D24] hover:bg-[#d04e1b] text-white px-2.5 rounded-lg font-medium cursor-pointer shadow-xs"
                          >
                            <ClipboardCheck className="h-3 w-3 mr-1" />
                            Quiz
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
