import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminActivityFilters {
  userId?: string;
  spaceId?: string;
  projectId?: string;
  eventType?: string;
  period?: "24h" | "7d" | "30d" | "all";
  limit?: number;
  offset?: number;
}

export interface AdminPlatformStats {
  users: {
    total: number;
    recentlyActive: number;
    recentList: Array<{
      id: string;
      email: string;
      displayName: string;
      isAdmin: boolean;
      createdAt: string;
    }>;
  };
  spaces: {
    total: number;
    recentList: Array<{
      id: string;
      name: string;
      userId: string;
      createdAt: string;
    }>;
  };
  projects: {
    total: number;
    recentList: Array<{
      id: string;
      name: string;
      userId: string;
      spaceId: string;
      createdAt: string;
    }>;
  };
  engagement: {
    activeUsersCount: number;
    totalProjects: number;
    totalAssessmentsCompleted: number;
    totalActivityEvents: number;
  };
  learningAnalytics: {
    totalAssessmentsCompleted: number;
    averageScore: number;
    masteryDistribution: {
      improving: number;
      stable: number;
      needsAttention: number;
    };
    totalConceptsAssessed: number;
  };
  aiUsage: {
    totalCalls: number;
    totalCostUsd: number;
    totalTokens: number;
    successRate: number;
    averageLatencyMs: number;
    callsByFeature: Record<string, number>;
    costByFeature: Record<string, number>;
    recentLogs: Array<{
      id: string;
      userId: string | null;
      feature: string;
      model: string;
      latencyMs: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCostUsd: number | null;
      status: "success" | "error";
      createdAt: string;
    }>;
  };
  backgroundProcessing: {
    materialsTotal: number;
    materialsReady: number;
    materialsProcessing: number;
    materialsFailed: number;
    recentFailures: Array<{
      id: string;
      fileName: string;
      errorMessage: string | null;
      projectId: string;
      createdAt: string;
    }>;
  };
  systemHealth: {
    status: "HEALTHY" | "DEGRADED";
    materialFailureRate: number;
    aiErrorRate: number;
    unresolvedIssuesCount: number;
  };
}

/**
 * Check if the given user ID has administrator privileges.
 */
export async function verifyAdminStatus(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("is_admin")
    .eq("id", userId)
    .single();

  return Boolean(profile?.is_admin);
}

/**
 * Fetch platform-level overview data for authorized administrators.
 * Server-side ONLY. Never expose ai_usage_logs or admin queries to client code.
 */
export async function getAdminPlatformOverview(
  filters: AdminActivityFilters = {}
): Promise<{ stats: AdminPlatformStats; filteredActivity: any[]; totalFilteredActivity: number }> {
  const supabase = createAdminClient();

  // 1. Fetch Users
  const { data: usersRaw, count: totalUsers } = await (supabase.from("profiles") as any)
    .select("id, email, display_name, is_admin, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  const usersList = (usersRaw || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name || u.email?.split("@")[0] || "User",
    isAdmin: Boolean(u.is_admin),
    createdAt: u.created_at,
  }));

  // 2. Fetch Spaces
  const { data: spacesRaw, count: totalSpaces } = await (supabase.from("spaces") as any)
    .select("id, name, user_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(10);

  const spacesList = (spacesRaw || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    userId: s.user_id,
    createdAt: s.created_at,
  }));

  // 3. Fetch Projects
  const { data: projectsRaw, count: totalProjects } = await (supabase.from("projects") as any)
    .select("id, name, user_id, space_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(10);

  const projectsList = (projectsRaw || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    userId: p.user_id,
    spaceId: p.space_id,
    createdAt: p.created_at,
  }));

  // 4. Fetch Materials (for background processing & health)
  const { data: materialsRaw, count: totalMaterials } = await (supabase.from("materials") as any)
    .select("id, project_id, file_name, status, error_message, created_at", { count: "exact" });

  const materials = materialsRaw || [];
  const materialsReady = materials.filter((m: any) => m.status === "ready").length;
  const materialsProcessing = materials.filter((m: any) => m.status === "processing" || m.status === "queued").length;
  const materialsFailed = materials.filter((m: any) => m.status === "failed").length;

  const recentFailures = materials
    .filter((m: any) => m.status === "failed")
    .slice(0, 5)
    .map((m: any) => ({
      id: m.id,
      fileName: m.file_name,
      errorMessage: m.error_message,
      projectId: m.project_id,
      createdAt: m.created_at,
    }));

  // 5. Fetch Assessments (learning analytics)
  const { data: assessmentsRaw, count: totalAssessments } = await (supabase.from("assessments") as any)
    .select("id, score, question_count, status, completed_at, started_at", { count: "exact" })
    .eq("status", "completed");

  const assessments = assessmentsRaw || [];
  const validScores = assessments
    .map((a: any) => (typeof a.score === "number" ? a.score : null))
    .filter((s: number | null): s is number => s !== null);

  const averageScore =
    validScores.length > 0
      ? Math.round((validScores.reduce((sum: number, s: number) => sum + s, 0) / validScores.length) * 10) / 10
      : 0;

  // 6. Fetch Concept Mastery distribution
  const { data: masteryRaw } = await (supabase.from("concept_mastery") as any)
    .select("concept_id, mastery_score, trend");

  const masteryList = masteryRaw || [];
  let improvingCount = 0;
  let stableCount = 0;
  let needsAttentionCount = 0;

  for (const m of masteryList) {
    if (m.trend === "IMPROVING") improvingCount++;
    else if (m.trend === "NEEDS_ATTENTION" || (m.mastery_score !== null && m.mastery_score < 60)) {
      needsAttentionCount++;
    } else {
      stableCount++;
    }
  }

  // 7. Fetch AI Usage Logs (server-side only)
  const { data: aiLogsRaw, count: totalAiCalls } = await (supabase.from("ai_usage_logs") as any)
    .select("id, user_id, feature, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(40);

  const aiLogs = aiLogsRaw || [];
  let totalCostUsd = 0;
  let totalTokens = 0;
  let successCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  const callsByFeature: Record<string, number> = {};
  const costByFeature: Record<string, number> = {};

  for (const log of aiLogs) {
    if (log.status === "success") successCount++;
    if (log.estimated_cost_usd) {
      const c = Number(log.estimated_cost_usd) || 0;
      totalCostUsd += c;
      costByFeature[log.feature] = (costByFeature[log.feature] || 0) + c;
    }
    if (log.input_tokens) totalTokens += log.input_tokens;
    if (log.output_tokens) totalTokens += log.output_tokens;
    if (log.latency_ms) {
      totalLatency += log.latency_ms;
      latencyCount++;
    }
    callsByFeature[log.feature] = (callsByFeature[log.feature] || 0) + 1;
  }

  const successRate = aiLogs.length > 0 ? Math.round((successCount / aiLogs.length) * 1000) / 10 : 100;
  const averageLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

  const recentAiLogs = aiLogs.map((l: any) => ({
    id: l.id,
    userId: l.user_id,
    feature: l.feature,
    model: l.model,
    latencyMs: l.latency_ms,
    inputTokens: l.input_tokens,
    outputTokens: l.output_tokens,
    estimatedCostUsd: l.estimated_cost_usd ? Number(l.estimated_cost_usd) : 0,
    status: l.status,
    createdAt: l.created_at,
  }));

  // 8. Filtered Platform Activity Events Query (Database-level filtering, Section D)
  let activityQuery = (supabase.from("activity_events") as any)
    .select("id, user_id, project_id, event_type, payload, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.userId) {
    activityQuery = activityQuery.eq("user_id", filters.userId);
  }
  if (filters.projectId) {
    activityQuery = activityQuery.eq("project_id", filters.projectId);
  } else if (filters.spaceId) {
    const { data: spaceProjects } = await (supabase.from("projects") as any)
      .select("id")
      .eq("space_id", filters.spaceId);
    const pIds = (spaceProjects || []).map((p: any) => p.id);
    if (pIds.length > 0) {
      activityQuery = activityQuery.in("project_id", pIds);
    } else {
      activityQuery = activityQuery.eq("project_id", "00000000-0000-0000-0000-000000000000");
    }
  }
  if (filters.eventType && filters.eventType !== "ALL") {
    activityQuery = activityQuery.eq("event_type", filters.eventType);
  }

  // Time period filter at query layer
  if (filters.period && filters.period !== "all") {
    const now = new Date();
    let msToSubtract = 24 * 60 * 60 * 1000;
    if (filters.period === "7d") msToSubtract = 7 * 24 * 60 * 60 * 1000;
    if (filters.period === "30d") msToSubtract = 30 * 24 * 60 * 60 * 1000;
    const sinceDate = new Date(now.getTime() - msToSubtract).toISOString();
    activityQuery = activityQuery.gte("created_at", sinceDate);
  }

  const limit = Math.min(filters.limit || 30, 50);
  const offset = filters.offset || 0;
  activityQuery = activityQuery.range(offset, offset + limit - 1);

  const { data: filteredEventsRaw, count: totalFilteredActivity } = await activityQuery;
  const filteredActivity = (filteredEventsRaw || []).map((e: any) => ({
    id: e.id,
    userId: e.user_id,
    projectId: e.project_id,
    eventType: e.event_type,
    payload: e.payload,
    createdAt: e.created_at,
  }));

  // Distinct recently active users (from activity events)
  const activeUserIds = new Set(filteredActivity.map((e: any) => e.userId));

  // System Health calculation
  const materialFailureRate =
    materials.length > 0 ? Math.round((materialsFailed / materials.length) * 1000) / 10 : 0;
  const aiErrorRate =
    aiLogs.length > 0 ? Math.round(((aiLogs.length - successCount) / aiLogs.length) * 1000) / 10 : 0;

  const isDegraded = materialFailureRate > 25 || aiErrorRate > 15;

  const stats: AdminPlatformStats = {
    users: {
      total: totalUsers ?? 0,
      recentlyActive: activeUserIds.size,
      recentList: usersList,
    },
    spaces: {
      total: totalSpaces ?? 0,
      recentList: spacesList,
    },
    projects: {
      total: totalProjects ?? 0,
      recentList: projectsList,
    },
    engagement: {
      activeUsersCount: activeUserIds.size,
      totalProjects: totalProjects ?? 0,
      totalAssessmentsCompleted: totalAssessments ?? 0,
      totalActivityEvents: totalFilteredActivity ?? 0,
    },
    learningAnalytics: {
      totalAssessmentsCompleted: totalAssessments ?? 0,
      averageScore,
      masteryDistribution: {
        improving: improvingCount,
        stable: stableCount,
        needsAttention: needsAttentionCount,
      },
      totalConceptsAssessed: masteryList.length,
    },
    aiUsage: {
      totalCalls: totalAiCalls ?? 0,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      totalTokens,
      successRate,
      averageLatencyMs,
      callsByFeature,
      costByFeature,
      recentLogs: recentAiLogs,
    },
    backgroundProcessing: {
      materialsTotal: totalMaterials ?? 0,
      materialsReady,
      materialsProcessing,
      materialsFailed,
      recentFailures,
    },
    systemHealth: {
      status: isDegraded ? "DEGRADED" : "HEALTHY",
      materialFailureRate,
      aiErrorRate,
      unresolvedIssuesCount: materialsFailed,
    },
  };

  return {
    stats,
    filteredActivity,
    totalFilteredActivity: totalFilteredActivity ?? 0,
  };
}

/**
 * Fetch complete user inspection detail for an authorized administrator.
 * Server-side ONLY.
 */
export async function getAdminUserDetail(targetUserId: string) {
  const supabase = createAdminClient();

  // 1. User profile
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("id, email, display_name, is_admin, created_at, updated_at")
    .eq("id", targetUserId)
    .single();

  if (!profile) return null;

  // 2. Spaces & Projects & Recommendations
  const [spacesRes, projectsRes, activityRes, assessmentsRes, masteryRes, aiLogsRes, recsRes] =
    await Promise.all([
      (supabase.from("spaces") as any)
        .select("id, name, description, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false }),

      (supabase.from("projects") as any)
        .select("id, name, description, learning_goal, space_id, created_at, updated_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false }),

      (supabase.from("activity_events") as any)
        .select("id, project_id, event_type, payload, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(25),

      (supabase.from("assessments") as any)
        .select("id, project_id, score, question_count, status, completed_at, started_at")
        .eq("user_id", targetUserId)
        .eq("status", "completed")
        .order("started_at", { ascending: false }),

      (supabase.from("concept_mastery") as any)
        .select("concept_id, project_id, mastery_score, trend, assessment_count, concepts(name), projects(name)")
        .eq("user_id", targetUserId)
        .order("mastery_score", { ascending: false }),

      (supabase.from("ai_usage_logs") as any)
        .select("id, feature, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(25),

      (supabase.from("recommendations") as any)
        .select("id, project_id, concept_id, priority, action_type, reasoning, status, created_at, projects(name)")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const assessments = assessmentsRes.data || [];
  const validScores = assessments
    .map((a: any) => (typeof a.score === "number" ? a.score : null))
    .filter((s: number | null): s is number => s !== null);

  const avgScore =
    validScores.length > 0
      ? Math.round((validScores.reduce((sum: number, s: number) => sum + s, 0) / validScores.length) * 10) / 10
      : 0;

  const aiLogs = aiLogsRes.data || [];
  const totalCostUsd = aiLogs.reduce(
    (sum: number, l: any) => sum + (Number(l.estimated_cost_usd) || 0),
    0
  );

  return {
    user: {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name || profile.email?.split("@")[0] || "User",
      isAdmin: Boolean(profile.is_admin),
      createdAt: profile.created_at,
    },
    spaces: spacesRes.data || [],
    projects: projectsRes.data || [],
    activity: activityRes.data || [],
    assessments,
    averageScore: avgScore,
    mastery: masteryRes.data || [],
    recommendations: recsRes.data || [],
    aiUsage: {
      totalCalls: aiLogs.length,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      logs: aiLogs,
    },
  };
}

