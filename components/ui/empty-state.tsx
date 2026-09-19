import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/30",
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 text-indigo-400 mb-4 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-white tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>

      {actionLabel && (onAction || actionHref) && (
        <div>
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white h-9 px-4 shadow-sm transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-4 shadow-sm"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
