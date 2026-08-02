import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/**
 * The calm refusal, shared by the list and the detail route.
 *
 * A panel rather than a crash or a redirect loop: someone following a link from
 * a colleague should be told plainly what this area is, not bounced. The
 * actions refuse independently and server-side regardless (§10.1).
 */
export function CrmNotForYourRole() {
  return (
    <>
      <PageHeader
        title="Stakeholders"
        subtitle="Contact records, and the briefs each contact has been sent."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-4 tablet:p-6">
        <div className="bg-card border-line rounded-card flex flex-col items-start gap-2 border p-6">
          <h2 className="text-ink text-[15px] font-semibold">
            This area is for the policy team
          </h2>
          <p className="text-ink-3 max-w-[62ch] text-[13px]">
            Stakeholder records are kept by the Policy &amp; Advocacy Officer and
            the Programme Director.
          </p>
          <Link href="/briefs" className={buttonVariants({ variant: "outline" })}>
            Back to the briefs
          </Link>
        </div>
      </div>
    </>
  );
}
