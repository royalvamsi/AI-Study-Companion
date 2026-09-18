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
  TrendingDown,
  Minus,
  Sparkles,
  ClipboardCheck,
  Brain,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  Activity,
  Layers,
  Cpu,
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
import type { ProjectAnalyticsData } from "@/lib/learning/project-analytics";

interface ProjectAnalyticsContentProps {
  data: ProjectAnalyticsData;
}

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  PROJECT_CREATED: { label: "Project Created", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  MATERIAL_UPLOADED: { label: "Material Uploaded", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  MATERIAL_PROCESSING: { label: "Processing", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  MATERIAL_READY: { label: "Material Ready", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  MATERIAL_FAILED: { label: "Material Failed", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  CONVERSATION_STARTED: { label: "Tutor Session", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  TUTOR_MESSAGE: { label: "Tutor Query", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  QUIZ_STARTED: { label: "Quiz Started", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  QUESTION_ANSWERED: { label: "Question Answered", color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  QUIZ_COMPLETED: { label: "Quiz Completed", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  MASTERY_UPDATED: { label: "Mastery Updated", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  RECOMMENDATION_CREATED: { label: "Recommendation", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  RECOMMENDATION_DISMISSED: { label: "Dismissed Rec", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  MISTAKE_RECORDED: { label: "Mistake Noted", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

export function ProjectAnalyticsContent({ data }: ProjectAnalyticsContentProps) {
  const { project, activity, assessments, growth, aiUsage } = data;

  // Format score trend for chart
  const scoreChartData = assessments.scoreTrend.map((a, idx) => ({
    name: `Quiz ${idx + 1}`,
    score: a.score,
    date: new Date(a.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  // Format AI feature chart data
  const featureChartData = Object.entries(aiUsage.callsByFeature).map(([feature, count]) => ({
    feature: feature.replace(/_/g, " "),
    count,
    cost: aiUsage.costByFeature[feature] || 0,
  }));

  const allConcepts = [
    ...growth.improving,
    ...growth.stable,
    ...growth.needsAttention,
  ].sort((a, b) => b.currentScore - a.currentScore);

  const avgMastery =
    allConcepts.length > 0
      ? Math.round(
          (allConcepts.reduce((sum, c) => sum + c.currentScore, 0) / allConcepts.length) * 10
        ) / 10
      : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Analytics" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-indigo-400" />
              {project.name} — Analytics
            </h1>
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs">
              Project Performance
            </Badge>
          </div>
          {project.learningGoal && (
            <p className="text-xs text-indigo-300 font-medium mt-1">
              🎯 Goal: {project.learningGoal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Project
            </Button>
          </Link>
          <Link href={`/quiz?project=${project.id}`}>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
              Take Quiz
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assessment Average */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Avg Quiz Score</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {assessments.totalCompleted > 0 ? `${assessments.averageScore}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400">
            {assessments.totalCompleted} completed {assessments.totalCompleted === 1 ? "quiz" : "quizzes"} (High: {assessments.highestScore}%, Low: {assessments.lowestScore}%)
          </CardContent>
        </Card>

        {/* Concept Mastery */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>Overall Concept Mastery</span>
              <Brain className="h-4 w-4 text-indigo-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {allConcepts.length > 0 ? `${avgMastery}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-emerald-400 font-medium">{growth.improving.length} improving</span>
            <span>•</span>
            <span className="text-rose-400 font-medium">{growth.needsAttention.length} needs attention</span>
          </CardContent>
        </Card>

        {/* AI Operations */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>AI Operations</span>
              <Cpu className="h-4 w-4 text-purple-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {aiUsage.totalCalls}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400">
            {aiUsage.successRate}% success rate • {aiUsage.averageLatencyMs}ms avg latency
          </CardContent>
        </Card>

        {/* Estimated AI Cost */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400 flex items-center justify-between">
              <span>AI Compute Usage</span>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              ${aiUsage.totalCostUsd.toFixed(4)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400">
            {aiUsage.totalTokens.toLocaleString()} total tokens consumed
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid: Assessments & Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assessment Performance Chart */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                Assessment Score Progression
              </span>
              <Badge variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-300 text-xs">
                {assessments.totalCompleted} attempts
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Score performance across completed quizzes over time
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {scoreChartData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${val}%`, "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                <ClipboardCheck className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                No completed assessments for this project yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concept Mastery Distribution */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                Concept Mastery Breakdown
              </span>
              <Badge variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-300 text-xs">
                {allConcepts.length} concepts
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Current proficiency per extracted concept
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {allConcepts.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {allConcepts.map((c) => {
                  const trendIcon =
                    c.trend === "IMPROVING" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : c.trend === "NEEDS_ATTENTION" ? (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-slate-400" />
                    );

                  return (
                    <div key={c.conceptId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 font-medium truncate max-w-[220px]">
                          {c.conceptName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">{trendIcon}</span>
                          <span className="text-slate-300 font-semibold">{c.currentScore}%</span>
                        </div>
                      </div>
                      <Progress
                        value={c.currentScore}
                        className="h-1.5 bg-slate-800"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Brain className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                No concepts assessed yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Activity & Learning Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Operations Breakdown */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                AI Feature Consumption
              </span>
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs">
                Telemetry
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Distribution of AI model requests across app features
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {featureChartData.length > 0 ? (
              <div className="space-y-3">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="feature" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400">Successful calls:</span>{" "}
                    <span className="text-emerald-400 font-medium">{aiUsage.successCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Error count:</span>{" "}
                    <span className="text-rose-400 font-medium">{aiUsage.errorCount}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Sparkles className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                No AI usage recorded for this project yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Activity Stream */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                Recent Project Activity
              </span>
              <Badge variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-300 text-xs">
                {activity.totalEvents} events
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Audit stream of learning actions within this project
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {activity.recentEvents.length > 0 ? (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
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
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-slate-800/40 border border-slate-800/60 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[240px]">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
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
                No activity logged yet for this project.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
