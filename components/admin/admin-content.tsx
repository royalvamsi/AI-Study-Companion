"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
  Sparkles,
  Server,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Filter,
  Eye,
  RefreshCw,
} from "lucide-react";
import type { AdminPlatformStats } from "@/lib/admin/admin-queries";

interface AdminContentProps {
  stats: AdminPlatformStats;
  filteredActivity: any[];
  totalFilteredActivity: number;
  currentFilters: {
    userId?: string;
    spaceId?: string;
    projectId?: string;
    eventType?: string;
    period?: string;
  };
}

const eventTypeMeta: Record<string, { label: string; color: string }> = {
  PROJECT_CREATED: { label: "Project Created", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_UPLOADED: { label: "Material Uploaded", color: "bg-stone-100 text-stone-700 border-stone-200" },
  MATERIAL_PROCESSING: { label: "Material Processing", color: "bg-amber-50 text-amber-700 border-amber-200" },
  MATERIAL_READY: { label: "Material Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MATERIAL_FAILED: { label: "Material Failed", color: "bg-rose-50 text-rose-700 border-rose-200" },
  CHAT_MESSAGE_SENT: { label: "Tutor Query", color: "bg-stone-100 text-stone-700 border-stone-200" },
  ASSESSMENT_STARTED: { label: "Quiz Started", color: "bg-stone-100 text-stone-700 border-stone-200" },
  ASSESSMENT_COMPLETED: { label: "Quiz Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RECOMMENDATION_CREATED: { label: "Recommendation Created", color: "bg-stone-100 text-stone-700 border-stone-200" },
  RECOMMENDATION_DISMISSED: { label: "Recommendation Dismissed", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function AdminContent({
  stats,
  filteredActivity,
  totalFilteredActivity,
  currentFilters,
}: AdminContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("overview");

  // Activity filters local state (Section D: User, Space, Project, Type, Period)
  const [filterUser, setFilterUser] = useState(currentFilters.userId || "ALL");
  const [filterSpace, setFilterSpace] = useState(currentFilters.spaceId || "ALL");
  const [filterProject, setFilterProject] = useState(currentFilters.projectId || "ALL");
  const [filterType, setFilterType] = useState(currentFilters.eventType || "ALL");
  const [filterPeriod, setFilterPeriod] = useState(currentFilters.period || "all");

  const hasActiveFilters = Boolean(
    (currentFilters.userId && currentFilters.userId !== "ALL") ||
    (currentFilters.spaceId && currentFilters.spaceId !== "ALL") ||
    (currentFilters.projectId && currentFilters.projectId !== "ALL") ||
    (currentFilters.eventType && currentFilters.eventType !== "ALL") ||
    (currentFilters.period && currentFilters.period !== "all")
  );

  function handleApplyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    if (filterUser && filterUser !== "ALL") {
      params.set("userId", filterUser);
    } else {
      params.delete("userId");
    }
    if (filterSpace && filterSpace !== "ALL") {
      params.set("spaceId", filterSpace);
    } else {
      params.delete("spaceId");
    }
    if (filterProject && filterProject !== "ALL") {
      params.set("projectId", filterProject);
    } else {
      params.delete("projectId");
    }
    if (filterType && filterType !== "ALL") {
      params.set("eventType", filterType);
    } else {
      params.delete("eventType");
    }
    if (filterPeriod && filterPeriod !== "all") {
      params.set("period", filterPeriod);
    } else {
      params.delete("period");
    }
    params.delete("offset"); // Reset pagination on filter change
    router.push(`/admin?${params.toString()}`);
  }

  function handleClearFilters() {
    setFilterUser("ALL");
    setFilterSpace("ALL");
    setFilterProject("ALL");
    setFilterType("ALL");
    setFilterPeriod("all");
    router.push("/admin");
  }

  return (
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin Operations" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b hairline">
        <div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500 font-sans">
              Operational Admin
            </span>
            <Badge
              variant="outline"
              className={
                stats.systemHealth.status === "HEALTHY"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs ml-2"
                  : "bg-rose-50 text-rose-700 border-rose-200 text-xs ml-2"
              }
            >
              System Health: {stats.systemHealth.status}
            </Badge>
          </div>
          <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight font-serif">
            Platform Operations & Intelligence
          </h1>
          <p className="text-sm text-neutral-600 mt-2 max-w-2xl leading-relaxed font-sans">
            Platform-level oversight: users, spaces, learning analytics, AI telemetry, and system health.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="border-black/10 bg-white hover:bg-neutral-50 text-[#171717] text-xs h-9 px-3.5 rounded-lg font-medium shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Primary Platform KPI Grid (B1, B6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Users */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">Total Users</span>
              <Users className="h-4 w-4 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">{stats.users.total}</div>
            <div className="text-[11px] text-neutral-500">{stats.users.recentlyActive} active in window</div>
          </CardContent>
        </Card>

        {/* Spaces & Projects */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">Projects</span>
              <FolderKanban className="h-4 w-4 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">{stats.projects.total}</div>
            <div className="text-[11px] text-neutral-500">{stats.spaces.total} Study Spaces</div>
          </CardContent>
        </Card>

        {/* Learning Assessments */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">Assessments</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">
              {stats.learningAnalytics.totalAssessmentsCompleted}
            </div>
            <div className="text-[11px] text-neutral-500">Avg score: {stats.learningAnalytics.averageScore}%</div>
          </CardContent>
        </Card>

        {/* Materials Status */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">Materials</span>
              <FileText className="h-4 w-4 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">
              {stats.backgroundProcessing.materialsTotal}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span className="text-emerald-600">{stats.backgroundProcessing.materialsReady} ready</span>
              {stats.backgroundProcessing.materialsFailed > 0 && (
                <span className="text-rose-600">· {stats.backgroundProcessing.materialsFailed} failed</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Invocations */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">AI Calls</span>
              <Bot className="h-4 w-4 text-amber-600" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">{stats.aiUsage.totalCalls}</div>
            <div className="text-[11px] text-neutral-500">{stats.aiUsage.successRate}% success rate</div>
          </CardContent>
        </Card>

        {/* AI Spend */}
        <Card className="border-black/10 bg-white shadow-sm rounded-xl">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs uppercase tracking-wider font-semibold">Total Spend</span>
              <DollarSign className="h-4 w-4 text-[#E85D24]" />
            </div>
            <div className="font-serif text-2xl font-normal text-[#171717] tracking-tight">
              ${stats.aiUsage.totalCostUsd.toFixed(4)}
            </div>
            <div className="text-[11px] text-neutral-500">{stats.aiUsage.totalTokens.toLocaleString()} tokens</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Administrative Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-stone-200/60 border border-black/10 p-1 flex-wrap rounded-lg">
          <TabsTrigger
            value="overview"
            className="text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors"
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Overview & Health
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors"
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Users & Spaces ({stats.users.total})
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Platform Activity ({totalFilteredActivity})
          </TabsTrigger>
          <TabsTrigger
            value="ai-usage"
            className="text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors"
          >
            <Cpu className="h-3.5 w-3.5 mr-1.5" />
            AI Telemetry ({stats.aiUsage.totalCalls})
          </TabsTrigger>
          <TabsTrigger
            value="background"
            className="text-xs rounded-md data-[state=active]:bg-[#171717] data-[state=active]:text-white transition-colors"
          >
            <Server className="h-3.5 w-3.5 mr-1.5" />
            Background Jobs & Failures
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW, ENGAGEMENT, LEARNING, AI EVALUATION & HEALTH */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Learning Analytics & Mastery Trends (B7) */}
            <Card className="border-black/10 bg-white shadow-sm rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Platform Learning Trends
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Aggregated student concept mastery distributions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-sm font-bold text-emerald-700 block">
                      {stats.learningAnalytics.masteryDistribution.improving}
                    </span>
                    <span className="text-[10px] text-neutral-500">Improving</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-100 border border-stone-200">
                    <span className="text-sm font-bold text-[#171717] block">
                      {stats.learningAnalytics.masteryDistribution.stable}
                    </span>
                    <span className="text-[10px] text-neutral-500">Stable</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-sm font-bold text-rose-700 block">
                      {stats.learningAnalytics.masteryDistribution.needsAttention}
                    </span>
                    <span className="text-[10px] text-neutral-500">Needs Focus</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 pt-1">
                  Across {stats.learningAnalytics.totalConceptsAssessed} tracked concept mastery instances.
                </p>
              </CardContent>
            </Card>

            {/* AI Evaluation Status (B9) */}
            <Card className="border-black/10 bg-white shadow-sm rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  AI Evaluation Architecture
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Current status of model benchmarking and evaluation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-2 text-xs">
                <div className="p-3.5 rounded-lg bg-[#F5F3EE] border border-black/5 text-[#171717] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#171717]">Automated LLM Evaluation:</span>
                    <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">
                      Not Configured
                    </Badge>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Automated model-level benchmarking (e.g. RAG faithfulness or LLM-as-a-judge) is not implemented in the current backend schema.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F3EE] border border-black/5 text-[#171717]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#171717]">Student Rubric Evaluation:</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                      Active
                    </Badge>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                    Automated rubric scoring on open-ended student quiz answers operates in real-time.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* System Health (B11) */}
            <Card className="border-black/10 bg-white shadow-sm rounded-xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                  <Server className="h-4 w-4 text-[#E85D24]" />
                  Application-Level Health
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Application metrics, failure rates, and background health
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="text-neutral-500">Operational Status:</span>
                  <Badge
                    variant="outline"
                    className={
                      stats.systemHealth.status === "HEALTHY"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }
                  >
                    {stats.systemHealth.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="text-neutral-500">Material Ingestion Failure Rate:</span>
                  <span className="font-medium text-[#171717]">
                    {stats.systemHealth.materialFailureRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="text-neutral-500">AI Operation Error Rate:</span>
                  <span className="font-medium text-[#171717]">
                    {stats.systemHealth.aiErrorRate}%
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 pt-1">
                  *Monitored at the Next.js application & Supabase service layer.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: USERS & SPACES (B2, B3, B4 & User Inspection Link, Section C) */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List with Inspection link */}
            <Card className="border-black/10 bg-white shadow-sm rounded-xl lg:col-span-2">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
                  <span>Registered Users ({stats.users.total})</span>
                  <Badge variant="outline" className="text-xs text-neutral-600 border-black/10 bg-[#F5F3EE] font-sans">
                    Click Inspect to view journey
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Inspect student workspaces, concept progress, and individual AI spend.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-black/10 text-neutral-500">
                        <th className="pb-2.5 font-medium">User</th>
                        <th className="pb-2.5 font-medium">Email</th>
                        <th className="pb-2.5 font-medium">Role</th>
                        <th className="pb-2.5 font-medium">Joined</th>
                        <th className="pb-2.5 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {stats.users.recentList.map((u) => (
                        <tr key={u.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 font-medium text-[#171717]">{u.displayName}</td>
                          <td className="py-3 text-neutral-500">{u.email}</td>
                          <td className="py-3">
                            {u.isAdmin ? (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-[#F5F3EE] text-neutral-600 border-black/10 text-[10px]">
                                Student
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-neutral-500 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">
                            <Link href={`/admin/users/${u.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-[#E85D24] hover:text-[#d04e1b] hover:bg-[#E85D24]/10 text-[11px] rounded-md font-medium"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Inspect
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Spaces & Projects Overview (B3, B4) */}
            <div className="space-y-4">
              <Card className="border-black/10 bg-white shadow-sm rounded-xl">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-[#E85D24]" />
                    Recent Study Spaces ({stats.spaces.total})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2 space-y-2">
                  {stats.spaces.recentList.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg bg-[#F5F3EE] border border-black/5 text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-[#171717] truncate max-w-[160px]">{s.name}</span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-black/10 bg-white shadow-sm rounded-xl">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="font-serif text-lg font-normal text-[#171717] flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#E85D24]" />
                    Recent Study Projects ({stats.projects.total})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2 space-y-2">
                  {stats.projects.recentList.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-[#F5F3EE] border border-black/5 text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-[#171717] truncate max-w-[160px]">{p.name}</span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: PLATFORM ACTIVITY FEED & ADVANCED FILTERS (B5, D) */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-black/10 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-4 border-b border-black/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#E85D24]" />
                    Platform Activity Audit Feed
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 mt-0.5">
                    Real-time audit log of student actions across users, spaces, and projects.
                  </CardDescription>
                </div>

                {/* Filter Controls (Section D: Database-level filtering for User, Space, Project, Event Type, Period) */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="bg-[#F5F3EE] border border-black/10 text-[#171717] text-xs rounded-lg px-2.5 py-1.5 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
                    title="Filter by User"
                  >
                    <option value="ALL">All Users</option>
                    {stats.users.recentList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSpace}
                    onChange={(e) => setFilterSpace(e.target.value)}
                    className="bg-[#F5F3EE] border border-black/10 text-[#171717] text-xs rounded-lg px-2.5 py-1.5 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
                    title="Filter by Space"
                  >
                    <option value="ALL">All Spaces</option>
                    {stats.spaces.recentList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="bg-[#F5F3EE] border border-black/10 text-[#171717] text-xs rounded-lg px-2.5 py-1.5 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
                    title="Filter by Project"
                  >
                    <option value="ALL">All Projects</option>
                    {stats.projects.recentList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-[#F5F3EE] border border-black/10 text-[#171717] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
                    title="Filter by Activity Type"
                  >
                    <option value="ALL">All Activity Types</option>
                    <option value="PROJECT_CREATED">Project Created</option>
                    <option value="MATERIAL_UPLOADED">Material Uploaded</option>
                    <option value="MATERIAL_PROCESSING">Material Processing</option>
                    <option value="MATERIAL_READY">Material Ready</option>
                    <option value="MATERIAL_FAILED">Material Failed</option>
                    <option value="CHAT_MESSAGE_SENT">Tutor Query</option>
                    <option value="ASSESSMENT_STARTED">Quiz Started</option>
                    <option value="ASSESSMENT_COMPLETED">Quiz Completed</option>
                    <option value="RECOMMENDATION_CREATED">Recommendation Created</option>
                  </select>

                  <select
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="bg-[#F5F3EE] border border-black/10 text-[#171717] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E85D24]"
                    title="Filter by Time Period"
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Past 24 Hours</option>
                    <option value="7d">Past 7 Days</option>
                    <option value="30d">Past 30 Days</option>
                  </select>

                  <Button
                    size="sm"
                    onClick={handleApplyFilters}
                    className="bg-[#E85D24] hover:bg-[#d04e1b] text-white text-xs h-8 px-3 rounded-lg shadow-sm font-medium"
                  >
                    Apply
                  </Button>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-neutral-500 hover:text-[#171717] text-xs h-8 px-2"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              {filteredActivity.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  <Activity className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                  No activity events matching filter. Try adjusting your time window or type filters.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredActivity.map((act) => {
                    const cfg = eventTypeMeta[act.eventType] || {
                      label: act.eventType.replace(/_/g, " "),
                      color: "bg-stone-100 text-stone-700 border-stone-200",
                    };

                    return (
                      <div
                        key={act.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#F5F3EE] border border-black/5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <div className="min-w-0">
                            <span className="text-neutral-500 text-[11px] font-mono mr-2">
                              User: {act.userId.slice(0, 8)}...
                            </span>
                            {act.payload && (
                              <span className="text-neutral-600 text-[11px] font-mono truncate">
                                {JSON.stringify(act.payload).slice(0, 80)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-neutral-400 text-[11px] shrink-0 ml-2">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: AI TELEMETRY & AUDIT (B8) */}
        <TabsContent value="ai-usage" className="space-y-4">
          <Card className="border-black/10 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-xl font-normal text-[#171717] flex flex-wrap items-center justify-between gap-2">
                <span>Recent AI Model Operations</span>
                <Badge variant="outline" className="bg-[#F5F3EE] text-neutral-600 border-black/10 text-[10px] font-sans">
                  gemini-3.5-flash • gemini-3.5-flash-lite • gemini-embedding-001
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Detailed latency, token count, and cost telemetry for every LLM operation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              {stats.aiUsage.recentLogs.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  <Cpu className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                  No AI telemetry recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-black/10 text-neutral-500">
                        <th className="pb-2.5 font-medium">Feature</th>
                        <th className="pb-2.5 font-medium">Model</th>
                        <th className="pb-2.5 font-medium">Latency</th>
                        <th className="pb-2.5 font-medium">Tokens (In / Out)</th>
                        <th className="pb-2.5 font-medium">Est. Cost</th>
                        <th className="pb-2.5 font-medium">Status</th>
                        <th className="pb-2.5 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {stats.aiUsage.recentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 font-medium text-[#171717] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D24]" />
                            {log.feature}
                          </td>
                          <td className="py-3 font-mono text-[11px] text-neutral-500">{log.model}</td>
                          <td className="py-3 text-neutral-600">
                            {log.latencyMs ? `${log.latencyMs}ms` : "—"}
                          </td>
                          <td className="py-3 font-mono text-[11px]">
                            <span className="text-neutral-500">{log.inputTokens ?? 0}</span>
                            {" / "}
                            <span className="text-[#171717] font-medium">{log.outputTokens ?? 0}</span>
                          </td>
                          <td className="py-3 font-mono text-[11px] text-emerald-600 font-medium">
                            ${(log.estimatedCostUsd ?? 0).toFixed(5)}
                          </td>
                          <td className="py-3">
                            {log.status === "success" ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0">
                                success
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] py-0">
                                error
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-neutral-400 text-[11px]">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
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

        {/* TAB 5: BACKGROUND PROCESSING & FAILURES (B10) */}
        <TabsContent value="background" className="space-y-4">
          <Card className="border-black/10 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="font-serif text-xl font-normal text-[#171717] flex items-center justify-between">
                <span>Ingestion Pipeline Failures & Exceptions</span>
                <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50 border-rose-200 font-sans">
                  {stats.backgroundProcessing.materialsFailed} Recorded Failures
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Audit log of documents that failed text extraction or chunking in Inngest background workers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              {stats.backgroundProcessing.recentFailures.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  No background processing failures recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stats.backgroundProcessing.recentFailures.map((fail) => (
                    <div
                      key={fail.id}
                      className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-900">{fail.fileName}</span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(fail.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-rose-700 text-[11px] font-mono leading-relaxed">
                        {fail.errorMessage || "Unknown processing error occurred in background pipeline."}
                      </p>
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
