import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center flex-wrap gap-1 text-xs text-neutral-500 ${className}`}
    >
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="group inline-flex items-center gap-1 py-1 hover:text-ink transition-colors font-medium"
              >
                {isFirst && (
                  <ArrowLeft className="h-3.5 w-3.5 text-neutral-400 group-hover:text-ink group-hover:-translate-x-0.5 transition-transform shrink-0" />
                )}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "text-ink font-semibold truncate max-w-[180px] sm:max-w-xs"
                    : "text-neutral-500 font-medium"
                }
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <span className="text-neutral-300 select-none text-xs mx-0.5" aria-hidden="true">
                /
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
