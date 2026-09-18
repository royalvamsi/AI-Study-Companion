import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { AdminUserDetail } from "@/components/admin/admin-user-detail";
import { getAdminUserDetail, verifyAdminStatus } from "@/lib/admin/admin-queries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin User Inspection — AI Study Companion",
  description: "Detailed user inspection, study journey, assessment history, and AI telemetry.",
};

interface AdminUserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Server-side authorization: only platform administrators can inspect users
  const isAdmin = await verifyAdminStatus(user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { userId } = await params;
  if (!userId) {
    notFound();
  }

  const userDetail = await getAdminUserDetail(userId);
  if (!userDetail) {
    notFound();
  }

  return <AdminUserDetail data={userDetail} />;
}
