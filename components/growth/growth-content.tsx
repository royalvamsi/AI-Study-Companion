"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  AlertTriangle,
  Sparkles,
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
}

const trendConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  IMPROVING: { icon: TrendingUp, color: "text-emerald-400", label: "Improving" },
  NEEDS_ATTENTION: { icon: TrendingDown, color: "text-red-400", label: "Needs attention" },
  STABLE: { icon: Minus, color: "text-slate-400", label: "Stable" },
};

function getBarColor(score: number): string {
  if (score >= 80) return "#34d399"; // emerald
  if (score >= 60) return "#60a5fa"; // blue
  if (score >= 40) return "#fbbf24"; // amber
  return "#f87171"; // red
}

export function GrowthContent({ projects, mastery }: GrowthContentProps) {
  const improving = mastery.filter((m) => m.trend === "IMPROVING");
  const needsAttention = mastery.filter((m) => m.trend === "NEEDS_ATTENTION");
  const avgMastery =
    mastery.length > 0
      ? mastery.reduce((sum, m) => sum + m.mastery_score, 0) / mastery.length
      : 0;

  // Prepare chart data
  const chartData = mastery
    .slice(0, 15)
    .map((m) => ({
      name: (m.concepts?.name ?? "Unknown").slice(0, 18),
      score: Math.round(m.mastery_score),
      fullName: m.concepts?.name ?? "Unknown",
    }));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">
        Learning Growth
      </h1>

      {mastery.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 text-indigo-400/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No mastery data yet
            </h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Complete quizzes to track your concept mastery and see your growth over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <Target className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {avgMastery.toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">Overall mastery</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <Brain className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{mastery.length}</p>
                    <p className="text-xs text-slate-500">Concepts tracked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {improving.length}
                    </p>
                    <p className="text-xs text-slate-500">Improving</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {needsAttention.length}
                    </p>
                    <p className="text-xs text-slate-500">Need attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800/60">
              <CardHeader>
                <CardTitle className="text-white text-base">
                  Concept Mastery Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                        }}
                        formatter={(value: any) => [`${value}%`, "Mastery"]}
                        labelFormatter={(label: any) => {
                          const item = chartData.find((d) => d.name === label);
                          return item?.fullName ?? String(label ?? "");
                        }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Concept list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mastery.map((m) => {
              const cfg = trendConfig[m.trend ?? "STABLE"] ?? trendConfig.STABLE;
              const TrendIcon = cfg.icon;

              return (
                <Card
                  key={m.concept_id}
                  className="bg-slate-900/40 border-slate-800/50"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">
                        {m.concepts?.name ?? "Unknown"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${cfg.color}`}
                        >
                          <TrendIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-sm font-bold text-white">
                          {m.mastery_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={m.mastery_score} className="h-1.5" />
                    <p className="text-xs text-slate-600">
                      {m.assessment_count} assessment{m.assessment_count !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
