import { ShieldCheck } from "lucide-react";

/**
 * Top institutional header for the unauthenticated landing & sign-in surface.
 * Displays Tropenbos Ghana identity, EviBrief wordmark, and system access status.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur-xs">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-4 tablet:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          {/* Abstract structural mark — a bordered square. No leaf, no tree (AGENTS.md §11.7) */}
          <span
            aria-hidden="true"
            className="size-[18px] rounded-[2px] border-2 border-primary"
          />
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold tracking-[0.12em] uppercase text-primary">
              EviBrief
            </span>
            <span className="hidden text-meta text-ink-3 font-normal tablet:inline">
              · Tropenbos Ghana
            </span>
          </div>
        </div>

        {/* System status pill */}
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-stone px-3 py-1 text-meta text-ink-2">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-accent"
            />
            <span className="truncate font-mono">
              <span className="tablet:hidden">Workspace SSO</span>
              <span className="hidden tablet:inline">
                Restricted Workspace SSO
              </span>
            </span>
          </div>

          <div className="hidden items-center gap-1.5 text-meta text-ink-3 laptop:flex">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>Institutional Governance Gate Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
