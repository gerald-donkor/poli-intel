import type { ReactNode } from "react";

import { requireStaffUser } from "@/lib/auth/session";

// Mobile-first and single-column at every size. This route is never adapted
// upward into a desktop layout — a Field Officer on a laptop still gets the
// digest (AGENTS.md §11.14, design-system.md closing rule). It carries none of
// the desktop nav.
//
// A session is required: §17.1's "no login friction" is *beyond* initial SSO,
// not instead of it. The read-only WhatsApp/USSD digest is the only no-login
// path and it does not live here. As in the (app) shell, this is a convenience
// redirect and not the enforcement boundary.
export default async function FieldLayout({ children }: { children: ReactNode }) {
  await requireStaffUser();

  return (
    <div className="bg-paper flex min-h-screen justify-center">
      <div className="bg-card border-line flex min-h-screen w-full max-w-[480px] flex-col border-x shadow-raised">
        {children}
      </div>
    </div>
  );
}

