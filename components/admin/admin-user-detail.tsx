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
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Navigation and Breadcrumb Header */}
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "User Inspection", href: `/admin/users/${user.id}` },
            { label: user.displayName },
          ]}
        />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">{user.displayName}</h1>
                  {user.isAdmin && (
                    <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 gap-1 text-[11px]">
                      <Shield className="w-3 h-3" />
                      Platform Admin
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>{user.email}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-slate-500">ID: {user.id}</span>
                  <span>•</span>
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Header Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Spaces</span>
              <Layers className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{spaces.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Projects</span>
              <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{projects.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Quizzes</span>
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white">{assessments.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Avg Score</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{averageScore}%</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>AI Operations</span>
              <Bot className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{aiUsage.totalCalls}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Est. Cost</span>
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">${aiUsage.totalCostUsd.toFixed(4)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="bg-slate-900/90 border border-slate-800 p-1">
          <TabsTrigger value="projects" className="gap-2 text-xs">
            <FolderKanban className="w-3.5 h-3.5" />
            Spaces & Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="mastery" className="gap-2 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            Concept Mastery ({mastery.length})
          </TabsTrigger>
          <TabsTrigger value="assessments" className="gap-2 text-xs">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Assessments ({assessments.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 text-xs">
            <Activity className="w-3.5 h-3.5" />
            Activity Log ({activity.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Recommendations ({recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 text-xs">
            <Bot className="w-3.5 h-3.5" />
            AI Telemetry ({aiUsage.totalCalls})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Spaces & Projects */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spaces List */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Spaces Owned ({spaces.length})
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Top-level organization spaces configured by this user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {spaces.length === 0 ? (
                  <EmptyState title="No Spaces" description="User has not created any spaces yet." />
                ) : (
                  spaces.map((space) => (
                    <div
                      key={space.id}
                      className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-slate-200">{space.name}</div>
                          {space.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{space.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(space.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Projects List */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-indigo-400" />
                  Learning Projects ({projects.length})
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Active study projects with defined learning goals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {projects.length === 0 ? (
                  <EmptyState title="No Projects" description="User has not created any projects yet." />
                ) : (
                  projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-slate-200">{proj.name}</div>
                          {proj.learning_goal && (
                            <p className="text-xs text-blue-400/90 mt-1 line-clamp-2">
                              🎯 Goal: {proj.learning_goal}
                            </p>
                          )}
                          {proj.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{proj.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Assessed Concept Mastery ({mastery.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Calculated mastery score, learning trend, and assessment history per concept
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mastery.length === 0 ? (
                <EmptyState
                  title="No Mastery Data"
                  description="User has not taken any assessments or established concept mastery."
                />
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {mastery.map((item, idx) => {
                    const score = Math.round(item.mastery_score ?? 0);
                    const isLow = score < 60 || item.trend === "NEEDS_ATTENTION";
                    const isHigh = score >= 80;

                    return (
                      <div key={item.concept_id || idx} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-[200px]">
                          <div className="text-sm font-medium text-slate-200">
                            {item.concepts?.name || item.concept_id}
                          </div>
                          <div className="text-xs text-slate-400">
                            Project: {item.projects?.name || "Global"} • Assessed {item.assessment_count} times
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <Badge
                            className={`text-[11px] ${
                              item.trend === "IMPROVING"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : item.trend === "NEEDS_ATTENTION"
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                            }`}
                          >
                            {item.trend}
                          </Badge>

                          <div className="w-32 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Mastery</span>
                              <span
                                className={`font-semibold ${
                                  isLow ? "text-rose-400" : isHigh ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                {score}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isLow ? "bg-rose-500" : isHigh ? "bg-emerald-500" : "bg-amber-500"
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-teal-400" />
                Completed Assessments ({assessments.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Performance history, questions answered, and scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assessments.length === 0 ? (
                <EmptyState
                  title="No Assessments Completed"
                  description="This user has not completed any quizzes yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800 pb-2">
                      <tr>
                        <th className="py-2.5 font-medium">Assessment ID</th>
                        <th className="py-2.5 font-medium">Questions</th>
                        <th className="py-2.5 font-medium">Score</th>
                        <th className="py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {assessments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono text-[11px] text-slate-400">{a.id}</td>
                          <td className="py-3">{a.question_count} questions</td>
                          <td className="py-3">
                            <span
                              className={`font-semibold ${
                                (a.score ?? 0) >= 80
                                  ? "text-emerald-400"
                                  : (a.score ?? 0) >= 60
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {a.score ?? 0}%
                            </span>
                          </td>
                          <td className="py-3 text-slate-400">
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                User Activity Stream ({activity.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Audited user-generated events across materials, assessments, and chat
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title="No Activity" description="No logged activity found for this user." />
              ) : (
                <div className="space-y-3">
                  {activity.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[11px]">
                          {eventTypeLabels[evt.event_type] || evt.event_type}
                        </Badge>
                        {evt.payload && (
                          <span className="text-xs text-slate-400 font-mono">
                            {JSON.stringify(evt.payload).slice(0, 70)}...
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Prescribed Recommendations ({recommendations.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Adaptive study suggestions generated for this user
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <EmptyState
                  title="No Recommendations"
                  description="User has no pending recommendations recorded."
                />
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-lg border border-slate-800/80 bg-slate-950/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                            {rec.action_type}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            Project: {rec.projects?.name || rec.project_id}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[11px] text-slate-500 border-slate-800">
                          Priority {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300">{rec.reasoning}</p>
                      <div className="text-[11px] text-slate-500">
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
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" />
                AI Usage Telemetry ({aiUsage.totalCalls} Calls)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Securely aggregated server-side token usage, latency, and estimated cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiUsage.logs.length === 0 ? (
                <EmptyState
                  title="No AI Usage"
                  description="This user has not generated any AI operations yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800 pb-2">
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
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {aiUsage.logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30">
                          <td className="py-3 font-semibold text-slate-200">{log.feature}</td>
                          <td className="py-3 font-mono text-[11px] text-slate-400">{log.model}</td>
                          <td className="py-3 text-slate-400">{log.latency_ms ?? 0}ms</td>
                          <td className="py-3 text-slate-400">
                            {log.input_tokens ?? 0} / {log.output_tokens ?? 0}
                          </td>
                          <td className="py-3 font-mono text-amber-400">
                            ${Number(log.estimated_cost_usd ?? 0).toFixed(4)}
                          </td>
                          <td className="py-3">
                            <Badge
                              className={`text-[10px] ${
                                log.status === "success"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-slate-400">
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
