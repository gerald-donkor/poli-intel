import { redirect } from "next/navigation";

import { getCurrentStaffUser, landingPathForRole } from "@/lib/auth/session";

// No marketing landing page is in scope. This route resolves where a person
// belongs from the role on their `StaffUser` row: a Field Officer lands on
// /field, everyone else on the daily-use Signals screen. An unauthenticated
// visitor goes to /signin.
export default async function RootPage() {
  const staffUser = await getCurrentStaffUser();

  if (!staffUser) redirect("/signin");

  redirect(landingPathForRole(staffUser.role));
}
