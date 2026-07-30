import { redirect } from "next/navigation";

// No marketing landing page is in scope. Signals is the daily-use screen.
// When auth lands this becomes role-dependent — a Field Officer should land on
// /field — but there is no session to read yet, so no role logic here.
export default function RootPage() {
  redirect("/signals");
}
