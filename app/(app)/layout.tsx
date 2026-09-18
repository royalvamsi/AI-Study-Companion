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

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F3EE]">
      <AppSidebar
        user={{
          id: user.id,
          email: user.email ?? "",
          displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "User",
          avatarUrl: profile?.avatar_url ?? null,
          isAdmin: profile?.is_admin ?? false,
        }}
      />
      <main className="flex-1 overflow-y-auto min-w-0 bg-[#F5F3EE]">{children}</main>
    </div>
  );
}
