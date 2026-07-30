import type { ReactNode } from "react";

// Mobile-first and single-column at every size. This route is never adapted
// upward into a desktop layout — a Field Officer on a laptop still gets the
// digest (AGENTS.md §11.14, design-system.md closing rule). It carries none of
// the desktop nav.
export default function FieldLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card border-line mx-auto flex min-h-full w-full max-w-[480px] flex-col border-x">
      {children}
    </div>
  );
}
