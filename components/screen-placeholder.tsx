import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type ScreenPlaceholderProps = {
  title: string;
  description: string;
  /** The prompt that will build this screen, e.g. "signal-dashboard prompt". */
  builtBy: string;
};

// Honest scaffolding: the route, the shell, and the token layer are real; the
// screen is not built yet and does not pretend to be. No invented evidence text.
export function ScreenPlaceholder({
  title,
  description,
  builtBy,
}: ScreenPlaceholderProps) {
  return (
    <Empty className="border-line bg-card m-6 border">
      <EmptyHeader>
        {/* Concentric contour rings — a topographic mark built from box-shadow,
            no icon asset (AGENTS.md §11.7). */}
        <EmptyMedia>
          <span
            aria-hidden="true"
            className="size-3 rounded-full shadow-[0_0_0_6px_var(--color-surface-tint),0_0_0_7px_var(--color-surface-tint-border),0_0_0_15px_var(--color-paper),0_0_0_16px_var(--color-line)]"
          />
        </EmptyMedia>
        <EmptyTitle className="text-ink text-[17px] font-semibold">
          {title}
        </EmptyTitle>
        <EmptyDescription className="text-ink-3 text-[13px]">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      <p className="text-ink-disabled font-mono text-[11.5px]">
        Built by the {builtBy}
      </p>
    </Empty>
  );
}
