import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Right-hand action slot. One primary action per view. */
  children?: ReactNode;
};

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="bg-card border-line border-b px-6 pt-[22px] pb-4">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-h1 text-ink font-semibold">{title}</h1>
          {subtitle ? (
            <p className="text-ink-3 text-[13px]">{subtitle}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
