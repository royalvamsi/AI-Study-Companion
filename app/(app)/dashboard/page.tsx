import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your AI Study Companion dashboard — see all your spaces, projects, and learning progress at a glance.",
};

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch spaces with their projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: spaces } = await (supabase.from("spaces") as any)
    .select("*, projects(id, name, description, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch recent activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentActivity } = await (supabase.from("activity_events") as any)
    .select("id, event_type, payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <DashboardContent
      userId={user.id}
      spaces={spaces ?? []}
      recentActivity={recentActivity ?? []}
    />
  );
}
