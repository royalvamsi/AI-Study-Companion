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
    <div className="flex flex-col h-full bg-[#F5F3EE] text-ink font-sans">
      {/* Brand Header */}
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

      <Separator className="bg-black/10" />

      {/* Navigation Links */}
      <div className="flex-1 p-3 space-y-6 overflow-y-auto">
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

        {/* Admin Section */}
        {user.isAdmin && (
          <div className="space-y-1">
            {(!collapsed || onNavigate) && (
              <p className="px-3 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                System
              </p>
            )}
            <Link
              href="/admin"
              onClick={onNavigate}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                pathname.startsWith("/admin")
                  ? "bg-white text-ink font-semibold shadow-xs border border-black/5"
                  : "text-neutral-600 hover:text-ink hover:bg-black/5"
              }`}
              title={collapsed && !onNavigate ? "Admin Control" : undefined}
            >
              {pathname.startsWith("/admin") && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-orange" />
              )}
              <Shield
                className={`h-4 w-4 shrink-0 transition-colors ${
                  pathname.startsWith("/admin")
                    ? "text-orange"
                    : "text-neutral-500 group-hover:text-ink"
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
      <div className="p-3 border-t border-black/10 bg-[#F5F3EE] shrink-0">
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
              <p className="text-xs font-semibold text-ink truncate">
                {user.displayName}
              </p>
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
              AI Study Companion
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
