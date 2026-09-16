"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

interface AppSidebarProps {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tutor", label: "AI Tutor", icon: MessageSquare },
  { href: "/quiz", label: "Quiz", icon: ClipboardCheck },
  { href: "/growth", label: "Growth", icon: TrendingUp },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-800/60 bg-slate-900/50 backdrop-blur-md transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex-shrink-0">
          <Brain className="h-5 w-5 text-indigo-400" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-tight truncate">
            AI Study Companion
          </span>
        )}
      </div>

      <Separator className="bg-slate-800/50" />

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={`h-[18px] w-[18px] flex-shrink-0 ${
                  isActive
                    ? "text-indigo-400"
                    : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin link */}
        {user.isAdmin && (
          <>
            <Separator className="bg-slate-800/50 my-2" />
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                pathname.startsWith("/admin")
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
              title={collapsed ? "Admin" : undefined}
            >
              <Shield
                className={`h-[18px] w-[18px] flex-shrink-0 ${
                  pathname.startsWith("/admin")
                    ? "text-amber-400"
                    : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              {!collapsed && <span>Admin Panel</span>}
            </Link>
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-8 flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* User section */}
      <div className="p-3 border-t border-slate-800/50">
        <div
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          )}
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full mt-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 justify-start ${
            collapsed ? "px-0 justify-center" : ""
          }`}
          size="sm"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
