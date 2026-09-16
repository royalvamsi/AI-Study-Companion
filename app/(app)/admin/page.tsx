import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminContent } from "@/components/admin/admin-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard — AI Study Companion",
  description: "System analytics, user management, and AI usage monitoring.",
};

export default async function AdminPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin authorization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  const userProfile = profile as any;
  if (!userProfile?.is_admin) {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  // Fetch system-wide counts and records in parallel
  const [
    usersResult,
    projectsResult,
    materialsResult,
    quizzesResult,
    aiLogsResult,
    activityResult,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, email, display_name, is_admin, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(20),
    adminClient
      .from("projects")
      .select("id, name, user_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(10),
    adminClient
      .from("materials")
      .select("id, status, file_type, size_bytes", { count: "exact" }),
    adminClient
      .from("assessments")
      .select("id, score, question_count, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(10),
    adminClient
      .from("ai_usage_logs")
      .select("id, user_id, feature, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(30),
    adminClient
      .from("activity_events")
      .select("id, user_id, event_type, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const materials = (materialsResult.data as any[]) ?? [];
  const aiLogs = (aiLogsResult.data as any[]) ?? [];

  // Aggregate stats
  const totalTokens = aiLogs.reduce(
    (acc: number, log: any) => acc + (log.input_tokens ?? 0) + (log.output_tokens ?? 0),
    0
  );
  const totalCost = aiLogs.reduce(
    (acc: number, log: any) => acc + (log.estimated_cost_usd ?? 0),
    0
  );

  const materialsReady = materials.filter((m: any) => m.status === "ready").length;
  const materialsFailed = materials.filter((m: any) => m.status === "failed").length;

  return (
    <AdminContent
      stats={{
        totalUsers: usersResult.count ?? 0,
        totalProjects: projectsResult.count ?? 0,
        totalMaterials: materialsResult.count ?? 0,
        materialsReady,
        materialsFailed,
        totalQuizzes: quizzesResult.count ?? 0,
        totalAiCalls: aiLogsResult.count ?? 0,
        totalTokens,
        totalCost,
      }}
      recentUsers={(usersResult.data as any[]) ?? []}
      recentProjects={(projectsResult.data as any[]) ?? []}
      recentAiLogs={aiLogs}
      recentActivity={(activityResult.data as any[]) ?? []}
    />
  );
}
