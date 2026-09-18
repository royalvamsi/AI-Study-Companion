"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Shield,
  User,
  FolderKanban,
  FileText,
  ClipboardCheck,
  Bot,
  DollarSign,
  Activity,
  Layers,
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle,
} from "lucide-react";

interface AdminUserDetailProps {
  data: {
    user: {
      id: string;
      email: string;
      displayName: string;
      isAdmin: boolean;
      createdAt: string;
    };
    spaces: Array<{
      id: string;
      name: string;
      description?: string | null;
      created_at: string;
    }>;
    projects: Array<{
      id: string;
      name: string;
      description?: string | null;
      learning_goal?: string | null;
      space_id: string;
      created_at: string;
      updated_at?: string | null;
    }>;
    activity: Array<{
      id: string;
      project_id?: string | null;
      event_type: string;
      payload?: any;
      created_at: string;
    }>;
    assessments: Array<{
      id: string;
      project_id: string;
      score: number | null;
      question_count: number;
      status: string;
      completed_at?: string | null;
      started_at: string;
    }>;
    averageScore: number;
    mastery: Array<{
      concept_id: string;
      project_id: string;
      mastery_score: number | null;
      trend: string;
      assessment_count: number;
      concepts?: { name: string } | null;
      projects?: { name: string } | null;
    }>;
    recommendations: Array<{
      id: string;
      project_id: string;
      concept_id?: string | null;
      priority: number;
      action_type: string;
      reasoning: string;
      status?: string | null;
      created_at: string;
      projects?: { name: string } | null;
    }>;
    aiUsage: {
      totalCalls: number;
      totalCostUsd: number;
      logs: Array<{
        id: string;
        feature: string;
        model: string;
        latency_ms: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        estimated_cost_usd: number | null;
        status: string;
        created_at: string;
      }>;
    };
  };
}

const eventTypeLabels: Record<string, string> = {
  PROJECT_CREATED: "Project Created",
  MATERIAL_UPLOADED: "Material Uploaded",
  MATERIAL_PROCESSING: "Material Processing",
  MATERIAL_READY: "Material Ready",
  MATERIAL_FAILED: "Material Failed",
  CHAT_MESSAGE_SENT: "Tutor Message",
  ASSESSMENT_STARTED: "Quiz Started",
  ASSESSMENT_COMPLETED: "Quiz Completed",
  RECOMMENDATION_CREATED: "Recommendation Added",
  RECOMMENDATION_DISMISSED: "Recommendation Dismissed",
};

export function AdminUserDetail({ data }: AdminUserDetailProps) {
  const { user, spaces, projects, activity, assessments, averageScore, mastery, recommendations, aiUsage } = data;

  return (
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
      {/* Navigation and Breadcrumb Header */}
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Platform Administration", href: "/admin" },
            { label: "Users & Spaces", href: "/admin?tab=users" },
            { label: user.displayName },
          ]}
        />
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b hairline">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-[#171717] hover:bg-stone-200/50 transition-colors border border-black/10 bg-white"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-500" />
              Back to Admin
            </Link>
            <div className="h-4 w-px bg-black/10" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-100 border border-black/10 flex items-center justify-center text-[#171717] font-semibold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl font-normal text-[#171717] tracking-tight">{user.displayName}</h1>
                  {user.isAdmin && (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 gap-1 text-[11px]">
                      <Shield className="w-3 h-3 text-[#E85D24]" />
                      Platform Admin
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                  <span>{user.email}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-neutral-400">ID: {user.id}</span>
                  <span>•</span>
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Header Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">Spaces</span>
              <Layers className="w-3.5 h-3.5 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717]">{spaces.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">Projects</span>
              <FolderKanban className="w-3.5 h-3.5 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717]">{projects.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">Quizzes</span>
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717]">{assessments.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">Avg Score</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="font-serif text-2xl font-normal text-emerald-700">{averageScore}%</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">AI Calls</span>
              <Bot className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717]">{aiUsage.totalCalls}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-black/10 shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="uppercase tracking-wider font-semibold">Spend</span>
              <DollarSign className="w-3.5 h-3.5 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717]">${aiUsage.totalCostUsd.toFixed(4)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="bg-stone-200/60 border border-black/10 p-1 flex-wrap rounded-lg">
          <TabsTrigger value="projects" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <FolderKanban className="w-3.5 h-3.5" />
            Spaces & Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="mastery" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <TrendingUp className="w-3.5 h-3.5" />
            Concept Mastery ({mastery.length})
          </TabsTrigger>
          <TabsTrigger value="assessments" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Assessments ({assessments.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <Activity className="w-3.5 h-3.5" />
            Activity Log ({activity.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            Recommendations ({recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors">
            <Bot className="w-3.5 h-3.5" />
            AI Telemetry ({aiUsage.totalCalls})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Spaces & Projects */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spaces List */}
            <Card className="bg-white border-black/10 shadow-sm rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#E85D24]" />
                  Spaces Owned ({spaces.length})
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Top-level organization spaces configured by this user
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-2.5">
                {spaces.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">User has not created any spaces yet.</div>
                ) : (
                  spaces.map((space) => (
                    <div
                      key={space.id}
                      className="p-3.5 rounded-lg border border-black/5 bg-[#F5F3EE] hover:border-black/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-[#171717]">{space.name}</div>
                          {space.description && (
                            <p className="text-xs text-neutral-500 mt-0.5">{space.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(space.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Projects List */}
            <Card className="bg-white border-black/10 shadow-sm rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[#E85D24]" />
                  Learning Projects ({projects.length})
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Active study projects with defined learning goals
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-2.5">
                {projects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">User has not created any projects yet.</div>
                ) : (
                  projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-3.5 rounded-lg border border-black/5 bg-[#F5F3EE] hover:border-black/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-[#171717]">{proj.name}</div>
                          {proj.learning_goal && (
                            <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                              🎯 Goal: {proj.learning_goal}
                            </p>
                          )}
                          {proj.description && (
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{proj.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(proj.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Concept Mastery */}
        <TabsContent value="mastery" className="space-y-4">
          <Card className="bg-white border-black/10 shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Assessed Concept Mastery ({mastery.length})
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Calculated mastery score, learning trend, and assessment history per concept
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {mastery.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  User has not taken any assessments or established concept mastery.
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {mastery.map((item, idx) => {
                    const score = Math.round(item.mastery_score ?? 0);
                    const isLow = score < 60 || item.trend === "NEEDS_ATTENTION";
                    const isHigh = score >= 80;

                    return (
                      <div key={item.concept_id || idx} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-[200px]">
                          <div className="text-sm font-medium text-[#171717]">
                            {item.concepts?.name || item.concept_id}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Project: {item.projects?.name || "Global"} • Assessed {item.assessment_count} times
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <Badge
                            className={`text-[11px] ${
                              item.trend === "IMPROVING"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.trend === "NEEDS_ATTENTION"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-stone-100 text-stone-700 border-stone-200"
                            }`}
                          >
                            {item.trend}
                          </Badge>

                          <div className="w-32 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Mastery</span>
                              <span
                                className={`font-semibold ${
                                  isLow ? "text-rose-700" : isHigh ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {score}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isLow ? "bg-rose-500" : isHigh ? "bg-emerald-500" : "bg-[#E85D24]"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Assessments */}
        <TabsContent value="assessments" className="space-y-4">
          <Card className="bg-white border-black/10 shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                Completed Assessments ({assessments.length})
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Performance history, questions answered, and scores
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {assessments.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  This user has not completed any quizzes yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-neutral-500 border-b border-black/10 pb-2">
                      <tr>
                        <th className="py-2.5 font-medium">Assessment ID</th>
                        <th className="py-2.5 font-medium">Questions</th>
                        <th className="py-2.5 font-medium">Score</th>
                        <th className="py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 text-[#171717]">
                      {assessments.map((a) => (
                        <tr key={a.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 font-mono text-[11px] text-neutral-500">{a.id}</td>
                          <td className="py-3">{a.question_count} questions</td>
                          <td className="py-3">
                            <span
                              className={`font-semibold ${
                                (a.score ?? 0) >= 80
                                  ? "text-emerald-700"
                                  : (a.score ?? 0) >= 60
                                  ? "text-amber-700"
                                  : "text-rose-700"
                              }`}
                            >
                              {a.score ?? 0}%
                            </span>
                          </td>
                          <td className="py-3 text-neutral-400">
                            {new Date(a.completed_at || a.started_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Activity Log */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="bg-white border-black/10 shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E85D24]" />
                User Activity Stream ({activity.length})
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Audited user-generated events across materials, assessments, and chat
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {activity.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">No logged activity found for this user.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {activity.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg border border-black/5 bg-[#F5F3EE] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[11px]">
                          {eventTypeLabels[evt.event_type] || evt.event_type}
                        </Badge>
                        {evt.payload && (
                          <span className="text-xs text-neutral-600 font-mono">
                            {JSON.stringify(evt.payload).slice(0, 70)}...
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(evt.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card className="bg-white border-black/10 shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Prescribed Recommendations ({recommendations.length})
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Adaptive study suggestions generated for this user
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {recommendations.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  User has no pending recommendations recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-lg border border-black/5 bg-[#F5F3EE] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
                            {rec.action_type}
                          </Badge>
                          <span className="text-xs text-neutral-600">
                            Project: {rec.projects?.name || rec.project_id}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[11px] text-neutral-500 border-black/10 bg-white">
                          Priority {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed">{rec.reasoning}</p>
                      <div className="text-[11px] text-neutral-400">
                        Generated {new Date(rec.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: AI Telemetry (Server-side aggregated) */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="bg-white border-black/10 shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#E85D24]" />
                AI Usage Telemetry ({aiUsage.totalCalls} Calls)
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Securely aggregated server-side token usage, latency, and estimated cost
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {aiUsage.logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  This user has not generated any AI operations yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-neutral-500 border-b border-black/10 pb-2">
                      <tr>
                        <th className="py-2.5 font-medium">Feature</th>
                        <th className="py-2.5 font-medium">Model</th>
                        <th className="py-2.5 font-medium">Latency</th>
                        <th className="py-2.5 font-medium">Tokens (In/Out)</th>
                        <th className="py-2.5 font-medium">Est. Cost</th>
                        <th className="py-2.5 font-medium">Status</th>
                        <th className="py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 text-[#171717]">
                      {aiUsage.logs.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 font-semibold text-[#171717]">{log.feature}</td>
                          <td className="py-3 font-mono text-[11px] text-neutral-500">{log.model}</td>
                          <td className="py-3 text-neutral-500">{log.latency_ms ?? 0}ms</td>
                          <td className="py-3 text-neutral-500 font-mono text-[11px]">
                            {log.input_tokens ?? 0} / {log.output_tokens ?? 0}
                          </td>
                          <td className="py-3 font-mono text-emerald-600 font-medium">
                            ${Number(log.estimated_cost_usd ?? 0).toFixed(4)}
                          </td>
                          <td className="py-3">
                            <Badge
                              className={`text-[10px] ${
                                log.status === "success"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-neutral-400 text-[11px]">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
