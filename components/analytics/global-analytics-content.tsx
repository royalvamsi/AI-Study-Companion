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
  PROJECT_CREATED: { label: "Project Created", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_UPLOADED: { label: "Material Uploaded", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_PROCESSED: { label: "Material Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MATERIAL_FAILED: { label: "Material Failed", color: "bg-rose-50 text-rose-700 border-rose-200" },
  CHAT_MESSAGE_SENT: { label: "Tutor Query", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ASSESSMENT_STARTED: { label: "Quiz Started", color: "bg-stone-100 text-stone-700 border-stone-200" },
  ASSESSMENT_COMPLETED: { label: "Quiz Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RECOMMENDATION_DISMISSED: { label: "Recommendation Dismissed", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

const FEATURE_COLORS = ["#171717", "#E85D24", "#737373", "#a8a29e", "#d97706", "#44403c"];

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-black/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E85D24]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Cross-Project Intelligence
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#171717] tracking-tight">
            Learning Analytics
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Aggregated cross-project intelligence: learning activity, assessment performance, mastery progress, and AI telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/projects">
            <Button
              variant="outline"
              size="sm"
              className="border-black/10 bg-white hover:bg-neutral-50 text-[#171717] text-xs h-9 px-3.5 rounded-lg font-medium shadow-sm"
            >
              <FolderKanban className="h-3.5 w-3.5 mr-1.5 text-[#E85D24]" />
              View Spaces & Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Workspaces</span>
              <FolderKanban className="h-4 w-4 text-[#E85D24]" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1">
              {summary.totalProjects}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-xs text-neutral-500">
              {summary.totalConceptsAssessed} concepts evaluated across projects
            </p>
          </CardContent>
        </Card>

        {/* Overall Mastery */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Average Mastery</span>
              <Brain className="h-4 w-4 text-[#E85D24]" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1 flex items-baseline gap-2">
              <span>{summary.overallAverageMastery}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <Progress value={summary.overallAverageMastery} className="h-1.5 bg-stone-100" />
            <p className="text-[11px] text-neutral-500">Weighted cross-project average</p>
          </CardContent>
        </Card>

        {/* Assessment Performance */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Assessments Completed</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1 flex items-baseline gap-2">
              <span>{summary.totalAssessmentsCompleted}</span>
              {summary.totalAssessmentsCompleted > 0 && (
                <span className="text-xs font-sans font-normal text-neutral-500">
                  Avg: {summary.overallAverageScore}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-xs text-neutral-500">
              {summary.totalAssessmentsCompleted > 0
                ? `Range: ${assessments.lowestScore}% - ${assessments.highestScore}%`
                : "No assessments completed yet"}
            </p>
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>AI Operations</span>
              <Sparkles className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1 flex items-baseline gap-2">
              <span>{aiUsage.totalCalls}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-200 bg-amber-50 text-amber-700 font-sans">
                ${aiUsage.totalCostUsd.toFixed(4)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-xs text-neutral-500">
              {aiUsage.totalTokens.toLocaleString()} total tokens · {aiUsage.successRate}% success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Overview Grid */}
      <Card className="bg-white border-black/10 shadow-sm rounded-xl">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-[#E85D24]" />
                Mastery & Progress by Project
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 mt-0.5">
                Overview of mastery levels and assessments completed across each project
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-neutral-600 border-black/10 bg-[#F5F3EE]">
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
                  className="p-4 rounded-xl border border-black/10 bg-[#F5F3EE] hover:border-black/20 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#171717] truncate">{p.projectName}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0 border-black/10 bg-white text-[#171717] font-medium">
                        {p.averageMastery}% Mastery
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {p.conceptCount} concepts tracked · {p.completedAssessments} quizzes completed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Progress value={p.averageMastery} className="h-1.5 bg-stone-200" />
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/projects/${p.projectId}/analytics`}
                        className="text-[11px] text-[#E85D24] hover:text-[#d04e1b] font-medium flex items-center gap-1"
                      >
                        <BarChart3 className="h-3 w-3" />
                        Project Analytics
                      </Link>
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="text-[11px] text-neutral-500 hover:text-[#171717] flex items-center gap-1"
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
            <div className="py-10 text-center text-neutral-500 text-xs">
              No projects created yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Columns: Score Trend & AI Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cross-Project Assessment Trend */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Cross-Project Assessment Scores
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Historical progression of quiz completion scores across all workspaces
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {chartTrendData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="date"
                      stroke="#737373"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#737373"
                      fontSize={11}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "rgba(0,0,0,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#171717",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
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
                      stroke="#E85D24"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#E85D24" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-neutral-400 text-xs">
                <ClipboardCheck className="h-8 w-8 text-neutral-300 mb-2" />
                No quiz assessments completed yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cross-Project AI Telemetry Breakdown */}
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-600" />
              AI Activity & Feature Telemetry
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Aggregated AI model operations across Tutor, Quizzes, Recommendations, and Extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {featureChartData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="name" stroke="#737373" fontSize={10} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "rgba(0,0,0,0.1)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#171717",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
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
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-black/5">
                  <div className="p-2.5 rounded-lg bg-[#F5F3EE]">
                    <span className="text-[10px] text-neutral-500 block">Total Cost</span>
                    <span className="text-xs font-semibold text-[#171717]">
                      ${aiUsage.totalCostUsd.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F5F3EE]">
                    <span className="text-[10px] text-neutral-500 block">Avg Latency</span>
                    <span className="text-xs font-semibold text-[#171717]">
                      {aiUsage.averageLatencyMs}ms
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F5F3EE]">
                    <span className="text-[10px] text-neutral-500 block">Success Rate</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {aiUsage.successRate}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-neutral-400 text-xs">
                <Sparkles className="h-8 w-8 text-neutral-300 mb-2" />
                No AI usage recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global Activity Feed */}
      <Card className="bg-white border-black/10 shadow-sm rounded-xl">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#E85D24]" />
              Recent Cross-Project Activity
            </CardTitle>
            <Badge variant="outline" className="text-xs text-neutral-600 border-black/10 bg-[#F5F3EE]">
              {activity.recentEvents.length} Recent Events
            </Badge>
          </div>
          <CardDescription className="text-xs text-neutral-500">
            Real-time audit log of learning events across all user spaces and projects
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-3">
          {activity.recentEvents.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {activity.recentEvents.map((ev) => {
                const cfg = eventTypeLabels[ev.eventType] || {
                  label: ev.eventType.replace(/_/g, " "),
                  color: "bg-stone-100 text-stone-700 border-stone-200",
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
                    className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-[#F5F3EE] border border-black/5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[420px]">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      {ev.projectName && (
                        <span className="text-[#171717] font-medium truncate text-xs">
                          [{ev.projectName}]
                        </span>
                      )}
                      {typeof ev.payload?.fileName === "string" && (
                        <span className="text-neutral-600 truncate">{ev.payload.fileName}</span>
                      )}
                      {typeof ev.payload?.actionType === "string" && (
                        <span className="text-neutral-500 truncate">{ev.payload.actionType}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400 shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-400 text-xs">
              <Activity className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
              No activity logged yet across projects.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
