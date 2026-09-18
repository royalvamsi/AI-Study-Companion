import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  let systemHealth: { status: "HEALTHY" | "DEGRADED"; issuesCount: number } | undefined;
  if (profile?.is_admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: failedMaterialsCount } = await (supabase.from("materials") as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    const issues = failedMaterialsCount || 0;
    systemHealth = {
      status: issues > 0 ? "DEGRADED" : "HEALTHY",
      issuesCount: issues,
    };
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F3EE]">
      <Suspense fallback={<aside className="hidden md:flex w-64 border-r border-black/10 bg-[#F5F3EE] shrink-0" />}>
        <AppSidebar
          user={{
            id: user.id,
            email: user.email ?? "",
            displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "User",
            avatarUrl: profile?.avatar_url ?? null,
            isAdmin: profile?.is_admin ?? false,
          }}
          systemHealth={systemHealth}
        />
      </Suspense>
      <main className="flex-1 overflow-y-auto min-w-0 bg-[#F5F3EE]">{children}</main>
    </div>
  );
}
