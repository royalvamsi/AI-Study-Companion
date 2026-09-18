"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  Lightbulb,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  BarChart3,
  Activity,
  Users,
  Filter,
  Cpu,
  Server,
  Zap,
  HeartPulse,
} from "lucide-react";

export interface AppSidebarUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

interface AppSidebarProps {
  user: AppSidebarUser;
  systemHealth?: {
    status: "HEALTHY" | "DEGRADED";
    issuesCount: number;
  };
}

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Spaces & Projects", icon: FolderKanban },
  { href: "/tutor", label: "AI Tutor", icon: MessageSquare },
  { href: "/quiz", label: "Adaptive Quiz", icon: ClipboardCheck },
  { href: "/growth", label: "Growth & Mastery", icon: TrendingUp },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
];

const adminNavItems = [
  {
    id: "overview",
    href: "/admin?tab=overview",
    label: "Admin Overview",
    icon: Zap,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && (tab === "overview" || !tab),
  },
  {
    id: "users",
    href: "/admin?tab=users",
    label: "Users & Spaces",
    icon: Users,
    isActive: (pathname: string, tab: string) =>
      (pathname === "/admin" && tab === "users") || pathname.startsWith("/admin/users"),
  },
  {
    id: "projects",
    href: "/admin?tab=projects",
    label: "Projects",
    icon: FolderKanban,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "projects",
  },
  {
    id: "activity",
    href: "/admin?tab=activity",
    label: "Platform Activity",
    icon: Filter,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "activity",
  },
  {
    id: "learning-analytics",
    href: "/admin?tab=learning-analytics",
    label: "Learning Analytics",
    icon: TrendingUp,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "learning-analytics",
  },
  {
    id: "ai-usage",
    href: "/admin?tab=ai-usage",
    label: "AI Telemetry",
    icon: Cpu,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "ai-usage",
  },
  {
    id: "background",
    href: "/admin?tab=background",
    label: "Background Jobs",
    icon: Server,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "background",
  },
  {
    id: "system-health",
    href: "/admin?tab=system-health",
    label: "System Health",
    icon: HeartPulse,
    isActive: (pathname: string, tab: string) =>
      pathname === "/admin" && tab === "system-health",
  },
];

export function AppSidebar({ user, systemHealth }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (user.displayName || user.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentTab = searchParams.get("tab") || "overview";

  const currentLearnerNav =
    mainNavItems.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    )?.label ?? "AI Study Companion";

  const currentAdminNav =
    adminNavItems.find((item) => item.isActive(pathname, currentTab))?.label ??
    "Platform Administration";

  const currentNav = user.isAdmin ? currentAdminNav : currentLearnerNav;

  const renderNavContent = (onNavigate?: () => void) => (
    <div className="flex flex-col h-full bg-[#F5F3EE] text-ink font-sans">
      {/* Brand Header */}
      {user.isAdmin ? (
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-ink flex items-center justify-center shrink-0">
            <div className="w-3.5 h-3.5 rounded-full border border-orange relative">
              <span className="absolute w-1 h-1 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          {(!collapsed || onNavigate) && (
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-ink tracking-tight block truncate">
                AI Study Companion
              </span>
              <span className="text-[10px] text-orange font-bold tracking-wider uppercase">
                Platform Administration
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-ink flex items-center justify-center shrink-0">
            <div className="w-3.5 h-3.5 rounded-full border border-orange relative">
              <span className="absolute w-1 h-1 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          {(!collapsed || onNavigate) && (
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-ink tracking-tight block truncate">
                AI Study Companion
              </span>
              <span className="text-[10px] text-neutral-500 font-medium tracking-wider uppercase">
                Workspace
              </span>
            </div>
          )}
        </div>
      )}

      <Separator className="bg-black/10" />

      {/* Navigation Links */}
      <div className="flex-1 p-3 space-y-6 overflow-y-auto">
        {user.isAdmin ? (
          /* ADMIN-ONLY NAVIGATION SHELL */
          <div className="space-y-1">
            {(!collapsed || onNavigate) && (
              <div className="flex items-center justify-between px-3 mb-2.5">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Platform Administration
                </p>
                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded bg-orange/10 text-orange border border-orange/20">
                  Admin
                </span>
              </div>
            )}
            {adminNavItems.map((item) => {
              const isActive = item.isActive(pathname, currentTab);
              const isHealth = item.id === "system-health";

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? "bg-white text-ink font-semibold shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-ink hover:bg-black/5"
                  }`}
                  title={collapsed && !onNavigate ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-orange" />
                  )}
                  <item.icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-orange"
                        : "text-neutral-500 group-hover:text-ink"
                    }`}
                  />
                  {(!collapsed || onNavigate) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {isHealth && (!collapsed || onNavigate) && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 border uppercase tracking-wider font-semibold shrink-0 ${
                        systemHealth?.status === "DEGRADED"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {systemHealth?.status || "HEALTHY"}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          /* LEARNER NAVIGATION (Unchanged for standard students) */
          <div className="space-y-1">
            {(!collapsed || onNavigate) && (
              <p className="px-3 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Learning Core
              </p>
            )}
            {mainNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? "bg-white text-ink font-semibold shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-ink hover:bg-black/5"
                  }`}
                  title={collapsed && !onNavigate ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-orange" />
                  )}
                  <item.icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-orange"
                        : "text-neutral-500 group-hover:text-ink"
                    }`}
                  />
                  {(!collapsed || onNavigate) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* User & Sign Out Footer */}
      <div className="p-3 border-t border-black/10 bg-[#F5F3EE] shrink-0">
        {/* Admin Issue Alert Banner if issues present */}
        {user.isAdmin && systemHealth && systemHealth.issuesCount > 0 && (!collapsed || onNavigate) && (
          <Link
            href="/admin?tab=system-health"
            onClick={onNavigate}
            className="mb-2.5 flex items-center justify-between px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-semibold">{systemHealth.issuesCount} Issues</span>
            </div>
            <span className="text-[10px] text-white/80 group-hover:text-white">Inspect →</span>
          </Link>
        )}

        <div
          className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-xl ${
            collapsed && !onNavigate ? "justify-center" : ""
          }`}
        >
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-black/10 bg-white">
            <AvatarFallback className="bg-white text-ink text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {(!collapsed || onNavigate) && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-ink truncate">
                  {user.displayName}
                </p>
                {user.isAdmin && (
                  <span className="text-[9px] px-1 py-0 rounded bg-stone-200/80 text-stone-700 font-medium">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
            </div>
          )}
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full mt-2 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 text-xs justify-start h-8 px-2 rounded-xl transition-colors cursor-pointer ${
            collapsed && !onNavigate ? "justify-center px-0" : ""
          }`}
          size="sm"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {(!collapsed || onNavigate) && <span className="ml-2">Sign out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (visible on md+) */}
      <aside
        className={`hidden md:flex relative flex-col border-r border-black/10 bg-[#F5F3EE] transition-all duration-300 z-20 shrink-0 ${
          collapsed ? "w-[70px]" : "w-64"
        }`}
      >
        {renderNavContent()}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-16 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 text-neutral-500 hover:text-ink hover:bg-neutral-50 shadow-xs transition-all z-30 cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* Mobile Top Navigation Bar (visible on < md) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-black/10 bg-[#F5F3EE] sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-ink flex items-center justify-center shrink-0">
            <div className="w-3 h-3 rounded-full border border-orange relative">
              <span className="absolute w-1 h-1 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold text-ink tracking-tight leading-tight">
              {user.isAdmin ? "Platform Administration" : "AI Study Companion"}
            </h2>
            <p className="text-[10px] text-neutral-500">{currentNav}</p>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-black/10 bg-white text-neutral-600 hover:text-ink hover:bg-neutral-50 transition-colors cursor-pointer"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 p-0 bg-[#F5F3EE] border-r border-black/10 text-ink"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            {renderNavContent(() => setMobileOpen(false))}
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
