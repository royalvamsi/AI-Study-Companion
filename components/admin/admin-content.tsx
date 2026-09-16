"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Users,
  FolderKanban,
  FileText,
  ClipboardCheck,
  Bot,
  DollarSign,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalMaterials: number;
  materialsReady: number;
  materialsFailed: number;
  totalQuizzes: number;
  totalAiCalls: number;
  totalTokens: number;
  totalCost: number;
}

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

interface ProjectRecord {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface AiLogRecord {
  id: string;
  user_id: string | null;
  feature: string;
  model: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  status: "success" | "error";
  created_at: string;
}

interface ActivityEventRecord {
  id: string;
  user_id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

interface AdminContentProps {
  stats: AdminStats;
  recentUsers: UserRecord[];
  recentProjects: ProjectRecord[];
  recentAiLogs: AiLogRecord[];
  recentActivity: ActivityEventRecord[];
}

export function AdminContent({
  stats,
  recentUsers,
  recentProjects,
  recentAiLogs,
  recentActivity,
}: AdminContentProps) {
  const [activeTab, setActiveTab] = useState("ai-usage");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Administrator Control Center
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            System Telemetry & Analytics
          </h1>
          <p className="text-sm text-slate-400">
            Real-time tracking of AI models, token burn, ingestion health, and user activities.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Users */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Users</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-[10px] text-slate-500">Registered accounts</div>
          </CardContent>
        </Card>

        {/* Total Projects */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Projects</span>
              <FolderKanban className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalProjects}</div>
            <div className="text-[10px] text-slate-500">Active study spaces</div>
          </CardContent>
        </Card>

        {/* Materials Processed */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Materials</span>
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalMaterials}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="text-emerald-400">{stats.materialsReady} ready</span>
              {stats.materialsFailed > 0 && (
                <span className="text-rose-400">· {stats.materialsFailed} failed</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quizzes Taken */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Quizzes</span>
              <ClipboardCheck className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalQuizzes}</div>
            <div className="text-[10px] text-slate-500">Assessments taken</div>
          </CardContent>
        </Card>

        {/* AI Invocations */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">AI Calls</span>
              <Bot className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalAiCalls}</div>
            <div className="text-[10px] text-slate-500">{stats.totalTokens.toLocaleString()} tokens</div>
          </CardContent>
        </Card>

        {/* Estimated AI Cost */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">AI Spend</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">${stats.totalCost.toFixed(4)}</div>
            <div className="text-[10px] text-slate-500">Estimated USD</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900/70 border border-slate-800/80 p-1">
          <TabsTrigger value="ai-usage" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Cpu className="h-3.5 w-3.5 mr-1.5" />
            AI Model Telemetry ({recentAiLogs.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Users & Roles ({recentUsers.length})
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
            Projects ({recentProjects.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Activity Log ({recentActivity.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Telemetry */}
        <TabsContent value="ai-usage" className="space-y-4">
          <Card className="border-slate-800/80 bg-slate-900/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base text-white flex items-center justify-between">
                <span>Recent AI Calls & Token Consumption</span>
                <Badge variant="outline" className="bg-slate-800 text-slate-400 text-[10px]">
                  gemini-3.5-flash · gemini-3.5-flash-lite · gemini-embedding-001
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Detailed latency, token count, and cost telemetry for every LLM operation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {recentAiLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No AI calls logged yet. Use the AI Tutor or upload materials to view logs.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-medium">Feature</th>
                        <th className="pb-2 font-medium">Model</th>
                        <th className="pb-2 font-medium">Latency</th>
                        <th className="pb-2 font-medium">Tokens (In / Out)</th>
                        <th className="pb-2 font-medium">Est. Cost</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentAiLogs.map((log) => (
                        <tr key={log.id} className="text-slate-300 hover:bg-slate-800/20">
                          <td className="py-2.5 font-medium text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            {log.feature}
                          </td>
                          <td className="py-2.5 font-mono text-[11px] text-slate-400">{log.model}</td>
                          <td className="py-2.5">
                            {log.latency_ms ? `${log.latency_ms}ms` : "—"}
                          </td>
                          <td className="py-2.5 font-mono text-[11px]">
                            <span className="text-slate-400">{log.input_tokens ?? 0}</span>
                            {" / "}
                            <span className="text-indigo-400">{log.output_tokens ?? 0}</span>
                          </td>
                          <td className="py-2.5 font-mono text-[11px] text-emerald-400">
                            ${(log.estimated_cost_usd ?? 0).toFixed(5)}
                          </td>
                          <td className="py-2.5">
                            {log.status === "success" ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] py-0">
                                success
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] py-0">
                                error
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-500 text-[11px]">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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

        {/* Tab 2: Users */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-slate-800/80 bg-slate-900/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base text-white">Registered Users</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Manage user privileges and monitor registration dates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentUsers.map((u) => (
                      <tr key={u.id} className="text-slate-300">
                        <td className="py-2.5 font-medium text-white">{u.display_name}</td>
                        <td className="py-2.5 text-slate-400">{u.email}</td>
                        <td className="py-2.5">
                          {u.is_admin ? (
                            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-800 text-slate-400 text-[10px]">
                              Student
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Projects */}
        <TabsContent value="projects" className="space-y-4">
          <Card className="border-slate-800/80 bg-slate-900/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base text-white">Active Projects</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Inspect projects created across workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {recentProjects.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No projects created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-medium">Project Name</th>
                        <th className="pb-2 font-medium">Project ID</th>
                        <th className="pb-2 font-medium">User ID</th>
                        <th className="pb-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentProjects.map((p) => (
                        <tr key={p.id} className="text-slate-300">
                          <td className="py-2.5 font-medium text-white">{p.name}</td>
                          <td className="py-2.5 font-mono text-[11px] text-slate-400">{p.id}</td>
                          <td className="py-2.5 font-mono text-[11px] text-slate-400">{p.user_id}</td>
                          <td className="py-2.5 text-slate-500 text-[11px]">
                            {new Date(p.created_at).toLocaleDateString()}
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

        {/* Tab 3: Activity Log */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-slate-800/80 bg-slate-900/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base text-white">Recent System Activity</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Audit trail of student study actions, quiz completions, and uploads.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {recentActivity.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30 border border-slate-800/60 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Activity className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-white mr-2">
                            {act.event_type.replace(/_/g, " ")}
                          </span>
                          {act.payload && (
                            <span className="text-slate-400 text-[11px] font-mono">
                              {JSON.stringify(act.payload).slice(0, 80)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-500 text-[11px] flex-shrink-0">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
