import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badge?: ReactNode;
  /** Right-hand action slot. One primary action per view. */
  children?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badge,
  children,
}: PageHeaderProps) {
  return (
    <div className="bg-card border-line border-b px-4 pt-4 pb-3.5 tablet:px-6 tablet:pt-5 tablet:pb-4">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-ink-3">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
                    {idx > 0 ? (
                      <ChevronRight aria-hidden="true" className="size-3 text-ink-disabled shrink-0" />
                    ) : null}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="hover:text-ink text-ink-3 no-underline hover:underline transition-colors duration-150"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? "text-ink font-medium" : ""}>
                        {crumb.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-ink font-semibold tracking-[-0.015em]">{title}</h1>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>

          {subtitle ? (
            <p className="text-ink-2 text-[13px] tablet:text-[13.5px] max-w-[80ch] leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>

        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 tablet:pt-0">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
