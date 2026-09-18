import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { AdminContent } from "@/components/admin/admin-content";
import { getAdminPlatformOverview, verifyAdminStatus } from "@/lib/admin/admin-queries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Admin — AI Study Companion",
  description: "Platform-level operational analytics, user management, and AI telemetry.",
};

interface AdminPageProps {
  searchParams: Promise<{
    userId?: string;
    spaceId?: string;
    projectId?: string;
    eventType?: string;
    period?: "24h" | "7d" | "30d" | "all";
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Server-side Admin authorization check
  const isAdmin = await verifyAdminStatus(user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filters = {
    userId: params.userId,
    spaceId: params.spaceId,
    projectId: params.projectId,
    eventType: params.eventType,
    period: params.period,
  };

  // Fetch platform-level overview using secure server-side admin client
  const { stats, filteredActivity, totalFilteredActivity } = await getAdminPlatformOverview(filters);

  return (
    <AdminContent
      stats={stats}
      filteredActivity={filteredActivity}
      totalFilteredActivity={totalFilteredActivity}
      currentFilters={filters}
    />
  );
}

