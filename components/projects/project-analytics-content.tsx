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
  PROJECT_CREATED: { label: "Project Created", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_UPLOADED: { label: "Material Uploaded", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_PROCESSING: { label: "Processing", color: "bg-amber-50 text-amber-700 border-amber-200" },
  MATERIAL_READY: { label: "Material Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MATERIAL_FAILED: { label: "Material Failed", color: "bg-rose-50 text-rose-700 border-rose-200" },
  CONVERSATION_STARTED: { label: "Tutor Session", color: "bg-stone-100 text-stone-700 border-stone-200" },
  TUTOR_MESSAGE: { label: "Tutor Query", color: "bg-amber-50 text-amber-700 border-amber-200" },
  QUIZ_STARTED: { label: "Quiz Started", color: "bg-stone-100 text-stone-700 border-stone-200" },
  QUESTION_ANSWERED: { label: "Question Answered", color: "bg-stone-100 text-stone-700 border-stone-200" },
  QUIZ_COMPLETED: { label: "Quiz Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MASTERY_UPDATED: { label: "Mastery Updated", color: "bg-amber-50 text-amber-700 border-amber-200" },
  RECOMMENDATION_CREATED: { label: "Recommendation", color: "bg-stone-100 text-stone-700 border-stone-200" },
  RECOMMENDATION_DISMISSED: { label: "Dismissed Rec", color: "bg-stone-100 text-stone-600 border-stone-200" },
  MISTAKE_RECORDED: { label: "Mistake Noted", color: "bg-rose-50 text-rose-700 border-rose-200" },
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
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Spaces & Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Analytics" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b hairline pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500 font-sans">
              Project Performance
            </span>
          </div>
          <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight font-serif">
            {project.name}
          </h1>
          {project.learningGoal && (
            <p className="text-xs text-neutral-500 font-medium mt-1">
              🎯 Goal: {project.learningGoal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/projects/${project.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-black/10 bg-white hover:bg-neutral-50 text-[#171717] text-xs h-9 px-3.5 rounded-lg font-medium shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
              Back to Project
            </Button>
          </Link>
          <Link href={`/quiz?project=${project.id}`}>
            <Button
              size="sm"
              className="bg-[#E85D24] hover:bg-[#d04e1b] text-white text-xs h-9 px-4 rounded-lg shadow-sm font-medium"
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              Take Quiz
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assessment Average */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Avg Quiz Score</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1">
              {assessments.totalCompleted > 0 ? `${assessments.averageScore}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-neutral-500">
            {assessments.totalCompleted} completed {assessments.totalCompleted === 1 ? "quiz" : "quizzes"} (High: {assessments.highestScore}%, Low: {assessments.lowestScore}%)
          </CardContent>
        </Card>

        {/* Concept Mastery */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Concept Mastery</span>
              <Brain className="h-4 w-4 text-[#E85D24]" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1">
              {allConcepts.length > 0 ? `${avgMastery}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-neutral-500 flex items-center gap-2">
            <span className="text-emerald-600 font-medium">{growth.improving.length} improving</span>
            <span>•</span>
            <span className="text-rose-600 font-medium">{growth.needsAttention.length} needs attention</span>
          </CardContent>
        </Card>

        {/* AI Operations */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>AI Operations</span>
              <Cpu className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1">
              {aiUsage.totalCalls}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-neutral-500">
            {aiUsage.successRate}% success rate • {aiUsage.averageLatencyMs}ms latency
          </CardContent>
        </Card>

        {/* Estimated AI Cost */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
              <span>Compute Usage</span>
              <DollarSign className="h-4 w-4 text-[#E85D24]" />
            </CardDescription>
            <CardTitle className="font-serif text-3xl font-normal text-[#171717] mt-1">
              ${aiUsage.totalCostUsd.toFixed(4)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-neutral-500">
            {aiUsage.totalTokens.toLocaleString()} total tokens consumed
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid: Assessments & Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assessment Performance Chart */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Assessment Progression
              </span>
              <Badge variant="outline" className="border-black/10 bg-[#F5F3EE] text-neutral-600 text-xs font-sans">
                {assessments.totalCompleted} attempts
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Score performance across completed quizzes over time
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {scoreChartData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="name" stroke="#737373" fontSize={11} tickLine={false} />
                    <YAxis stroke="#737373" fontSize={11} domain={[0, 100]} tickLine={false} />
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
              <div className="py-12 text-center text-neutral-400 text-xs">
                <ClipboardCheck className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                No completed assessments for this project yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concept Mastery Distribution */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-[#E85D24]" />
                Concept Mastery Breakdown
              </span>
              <Badge variant="outline" className="border-black/10 bg-[#F5F3EE] text-neutral-600 text-xs font-sans">
                {allConcepts.length} concepts
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Current proficiency per extracted concept
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {allConcepts.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {allConcepts.map((c) => {
                  const trendIcon =
                    c.trend === "IMPROVING" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    ) : c.trend === "NEEDS_ATTENTION" ? (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-neutral-400" />
                    );

                  return (
                    <div key={c.conceptId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#171717] font-medium truncate max-w-[220px]">
                          {c.conceptName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 text-[11px]">{trendIcon}</span>
                          <span className="text-[#171717] font-semibold">{c.currentScore}%</span>
                        </div>
                      </div>
                      <Progress
                        value={c.currentScore}
                        className="h-1.5 bg-stone-100"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-neutral-400 text-xs">
                <Brain className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                No concepts assessed yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Activity & Learning Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Operations Breakdown */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                AI Feature Consumption
              </span>
              <Badge variant="outline" className="border-black/10 bg-[#F5F3EE] text-neutral-600 text-xs font-sans">
                Telemetry
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Distribution of AI model requests across app features
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {featureChartData.length > 0 ? (
              <div className="space-y-3">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="feature" stroke="#737373" fontSize={11} tickLine={false} />
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
                      />
                      <Bar dataKey="count" fill="#171717" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 text-xs">
                  <div>
                    <span className="text-neutral-500">Successful calls:</span>{" "}
                    <span className="text-emerald-600 font-medium">{aiUsage.successCount}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Error count:</span>{" "}
                    <span className="text-rose-600 font-medium">{aiUsage.errorCount}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-neutral-400 text-xs">
                <Sparkles className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                No AI usage recorded for this project yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Activity Stream */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#E85D24]" />
                Recent Project Activity
              </span>
              <Badge variant="outline" className="border-black/10 bg-[#F5F3EE] text-neutral-600 text-xs font-sans">
                {activity.totalEvents} events
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Audit stream of learning actions within this project
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {activity.recentEvents.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F3EE] border border-black/5 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[240px]">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        {typeof ev.payload?.fileName === "string" && (
                          <span className="text-[#171717] truncate">{ev.payload.fileName}</span>
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
                No activity logged yet for this project.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
