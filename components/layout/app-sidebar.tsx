"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Brain,
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  ClipboardCheck,
  TrendingUp,
  Lightbulb,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
  BarChart3,
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

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
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

  const currentNav =
    mainNavItems.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    )?.label ??
    (pathname.startsWith("/admin") ? "Admin Panel" : "AI Study Companion");

  const renderNavContent = (onNavigate?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-4 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 shrink-0 shadow-sm">
          <Brain className="h-5 w-5" />
        </div>
        {(!collapsed || onNavigate) && (
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-white tracking-tight block truncate">
              AI Study Companion
            </span>
            <span className="text-[10px] text-indigo-400/90 font-medium tracking-wide uppercase flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> Workspace
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-slate-800/80" />

      {/* Navigation Links */}
      <div className="flex-1 p-3 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          {(!collapsed || onNavigate) && (
            <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                  isActive
                    ? "bg-indigo-500/15 text-white font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
                title={collapsed && !onNavigate ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-indigo-400" />
                )}
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive
                      ? "text-indigo-400"
                      : "text-slate-400 group-hover:text-slate-300"
                  }`}
                />
                {(!collapsed || onNavigate) && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        {user.isAdmin && (
          <div className="space-y-1">
            {(!collapsed || onNavigate) && (
              <p className="px-3 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-2">
                System
              </p>
            )}
            <Link
              href="/admin"
              onClick={onNavigate}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                pathname.startsWith("/admin")
                  ? "bg-amber-500/15 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
              title={collapsed && !onNavigate ? "Admin Control" : undefined}
            >
              {pathname.startsWith("/admin") && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-amber-400" />
              )}
              <Shield
                className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                  pathname.startsWith("/admin")
                    ? "text-amber-400"
                    : "text-slate-400 group-hover:text-slate-300"
                }`}
              />
              {(!collapsed || onNavigate) && (
                <span className="truncate">Admin Control</span>
              )}
            </Link>
          </div>
        )}
      </div>

      {/* User & Sign Out Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 shrink-0">
        <div
          className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-lg ${
            collapsed && !onNavigate ? "justify-center" : ""
          }`}
        >
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-slate-700/60">
            <AvatarFallback className="bg-indigo-600/30 text-indigo-200 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {(!collapsed || onNavigate) && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user.displayName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          )}
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full mt-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs justify-start h-8 px-2 transition-colors ${
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
        className={`hidden md:flex relative flex-col border-r border-slate-800/80 bg-slate-900/70 backdrop-blur-md transition-all duration-300 z-20 shrink-0 ${
          collapsed ? "w-[70px]" : "w-64"
        }`}
      >
        {renderNavContent()}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-16 flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 shadow-md transition-all z-30"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* Mobile Top Navigation Bar (visible on < md) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-white tracking-tight leading-tight">
              AI Study Companion
            </h2>
            <p className="text-[10px] text-slate-400">{currentNav}</p>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 p-0 bg-slate-950 border-r border-slate-800 text-slate-100"
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
