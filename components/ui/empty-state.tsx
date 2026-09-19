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
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-black/10 bg-white",
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#F5F3EE] border border-black/10 text-orange mb-4 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>

      {actionLabel && (onAction || actionHref) && (
        <div>
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center rounded-lg bg-orange hover:bg-[#d04e1b] text-xs font-medium text-white h-9 px-4 shadow-sm transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="bg-orange hover:bg-[#d04e1b] text-white text-xs h-9 px-4 shadow-sm"
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
