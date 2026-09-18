"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  BarChart3,
  TrendingUp,
  Brain,
  ClipboardCheck,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  DollarSign,
  Activity,
  Cpu,
  FolderKanban,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { GlobalAnalyticsData } from "@/lib/learning/global-analytics";

interface GlobalAnalyticsContentProps {
  data: GlobalAnalyticsData;
}

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  PROJECT_CREATED: { label: "Project Created", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  MATERIAL_UPLOADED: { label: "Material Uploaded", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  MATERIAL_PROCESSED: { label: "Material Ready", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  MATERIAL_FAILED: { label: "Material Failed", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  CHAT_MESSAGE_SENT: { label: "Tutor Query", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  ASSESSMENT_STARTED: { label: "Quiz Started", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  ASSESSMENT_COMPLETED: { label: "Quiz Completed", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  RECOMMENDATION_DISMISSED: { label: "Recommendation Dismissed", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const FEATURE_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export function GlobalAnalyticsContent({ data }: GlobalAnalyticsContentProps) {
  const { summary, projectMasteries, activity, assessments, aiUsage } = data;

  const featureChartData = Object.entries(aiUsage.callsByFeature).map(([feature, count], idx) => ({
    name: feature.replace(/_/g, " "),
    calls: count,
    cost: aiUsage.costByFeature[feature] || 0,
    color: FEATURE_COLORS[idx % FEATURE_COLORS.length],
  }));

  const chartTrendData = assessments.scoreTrend.map((t, idx) => ({
    label: `#${idx + 1} (${t.projectName})`,
    score: t.score,
    projectName: t.projectName,
    date: new Date(t.completedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Global Analytics" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Learning Analytics
            </h1>
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs">
              All Projects
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated cross-project intelligence: learning activity, assessment performance, mastery progress, and AI telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/projects">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs h-9 px-3.5"
            >
              <FolderKanban className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              View Spaces & Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Workspaces</span>
              <FolderKanban className="h-4 w-4 text-blue-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white mt-1">
              {summary.totalProjects}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-slate-400">
              {summary.totalConceptsAssessed} concepts evaluated across projects
            </p>
          </CardContent>
        </Card>

        {/* Overall Mastery */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Overall Average Mastery</span>
              <Brain className="h-4 w-4 text-purple-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white mt-1 flex items-baseline gap-2">
              <span>{summary.overallAverageMastery}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1.5">
            <Progress value={summary.overallAverageMastery} className="h-1.5 bg-slate-800" />
            <p className="text-[11px] text-slate-400">Weighted cross-project average</p>
          </CardContent>
        </Card>

        {/* Assessment Performance */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Assessments Completed</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white mt-1 flex items-baseline gap-2">
              <span>{summary.totalAssessmentsCompleted}</span>
              {summary.totalAssessmentsCompleted > 0 && (
                <span className="text-xs font-normal text-slate-400">
                  Avg: {summary.overallAverageScore}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-slate-400">
              {summary.totalAssessmentsCompleted > 0
                ? `Range: ${assessments.lowestScore}% - ${assessments.highestScore}%`
                : "No assessments completed yet"}
            </p>
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Total AI Operations</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white mt-1 flex items-baseline gap-2">
              <span>{aiUsage.totalCalls}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-300">
                ${aiUsage.totalCostUsd.toFixed(4)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-slate-400">
              {aiUsage.totalTokens.toLocaleString()} total tokens · {aiUsage.successRate}% success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Overview Grid */}
      <Card className="bg-slate-900/60 border-slate-800/80">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-indigo-400" />
                Mastery & Progress by Project
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Overview of mastery levels and assessments completed across each project
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
              {projectMasteries.length} Projects
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {projectMasteries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {projectMasteries.map((p) => (
                <div
                  key={p.projectId}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{p.projectName}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0 border-indigo-500/30 text-indigo-300">
                        {p.averageMastery}% Mastery
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {p.conceptCount} concepts tracked · {p.completedAssessments} quizzes completed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Progress value={p.averageMastery} className="h-1.5 bg-slate-800" />
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/projects/${p.projectId}/analytics`}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <BarChart3 className="h-3 w-3" />
                        Project Analytics
                      </Link>
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-1"
                      >
                        View Project
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs">
              No projects created yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Columns: Score Trend & AI Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cross-Project Assessment Trend */}
        <Card className="bg-slate-900/60 border-slate-800/80">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Cross-Project Assessment Scores
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Historical progression of quiz completion scores across all workspaces
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {chartTrendData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${val}%`, "Score"]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.projectName} (${item.date})` : label;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ClipboardCheck className="h-8 w-8 text-slate-600 mb-2" />
                No quiz assessments completed yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cross-Project AI Telemetry Breakdown */}
        <Card className="bg-slate-900/60 border-slate-800/80">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-400" />
              AI Activity & Feature Telemetry
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Aggregated AI model operations across Tutor, Quizzes, Recommendations, and Extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {featureChartData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} calls (${item.payload.cost ? `$${item.payload.cost.toFixed(4)}` : "$0.00"})`,
                          "Volume",
                        ]}
                      />
                      <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                        {featureChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Subtext metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-800">
                  <div className="p-2 rounded bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 block">Total Cost</span>
                    <span className="text-xs font-semibold text-slate-200">
                      ${aiUsage.totalCostUsd.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 block">Avg Latency</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {aiUsage.averageLatencyMs}ms
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 block">Success Rate</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {aiUsage.successRate}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Sparkles className="h-8 w-8 text-slate-600 mb-2" />
                No AI usage recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global Activity Feed */}
      <Card className="bg-slate-900/60 border-slate-800/80">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Recent Cross-Project Activity
            </CardTitle>
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
              {activity.recentEvents.length} Recent Events
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400">
            Real-time audit log of learning events across all user spaces and projects
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          {activity.recentEvents.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {activity.recentEvents.map((ev) => {
                const cfg = eventTypeLabels[ev.eventType] || {
                  label: ev.eventType.replace(/_/g, " "),
                  color: "bg-slate-500/15 text-slate-300 border-slate-500/30",
                };
                const timeStr = new Date(ev.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-800/40 border border-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[420px]">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      {ev.projectName && (
                        <span className="text-indigo-300 font-medium truncate text-xs">
                          [{ev.projectName}]
                        </span>
                      )}
                      {typeof ev.payload?.fileName === "string" && (
                        <span className="text-slate-300 truncate">{ev.payload.fileName}</span>
                      )}
                      {typeof ev.payload?.actionType === "string" && (
                        <span className="text-slate-400 truncate">{ev.payload.actionType}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Activity className="h-8 w-8 mx-auto text-slate-600 mb-2" />
              No activity logged yet across projects.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
