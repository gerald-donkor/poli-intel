import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentStaffUser, landingPathForRole } from "@/lib/auth/session";

import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { PipelinePreview } from "./pipeline-preview";
import { CapabilitiesGrid } from "./capabilities-grid";
import { LandscapeSection } from "./landscape-section";
import { LandingFooter } from "./landing-footer";
import { LandingMotion } from "./landing-motion";

export const metadata: Metadata = {
  title: "EviBrief · Policy Intelligence for Tropenbos Ghana",
  description:
    "Monitors Ghanaian and international forest-policy windows, connects them directly to verified landscape evidence from Juabeso-Bia and Sefwi-Wiawso, and drafts audience-tailored briefs with post-generation fact checking.",
};

// Auth.js redirects here with `?error=` because `pages.error` points at this
// route — no default Auth.js UI is ever reachable. `AccessDenied` is what the
// `signIn` callback's `false` produces, which for this product means exactly
// one thing: the identity is not a verified account on the Workspace domain.
function alertCopy(errorCode: string | undefined) {
  if (!errorCode) return null;

  if (errorCode === "AccessDenied") {
    return {
      title: "That account can't sign in here",
      description:
        "EviBrief is restricted to the Tropenbos Ghana Workspace. Sign in with your work account.",
    };
  }

  return {
    title: "Sign-in didn't complete",
    description: "Something interrupted the sign-in. Try again.",
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const staffUser = await getCurrentStaffUser();
  if (staffUser) redirect(landingPathForRole(staffUser.role));

  const { error } = await searchParams;
  const alert = alertCopy(Array.isArray(error) ? error[0] : error);

  return (
    <LandingMotion className="flex min-h-full flex-col bg-paper text-ink selection:bg-surface-tint selection:text-surface-tint-ink">
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        <LandingHero alert={alert} />
        <div className="border-t border-line/60 bg-stone/30">
          <PipelinePreview />
        </div>
        <div className="border-t border-line/60">
          <CapabilitiesGrid />
        </div>
        <div className="border-t border-line/60 bg-stone/20">
          <LandscapeSection />
        </div>
      </main>
      <LandingFooter />
    </LandingMotion>
  );
}
