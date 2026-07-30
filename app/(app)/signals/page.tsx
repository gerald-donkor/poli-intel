import { PageHeader } from "@/components/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata = {
  title: "Signals · EviBrief",
};

export default function SignalsPage() {
  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Policy developments picked up across Ghana, the EU, and international bodies. Acting on one is always your call."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <ScreenPlaceholder
          title="The signal board goes here"
          description="Four urgency columns — immediate, near-term, horizon, watch — with drag-to-reclassify and a morning digest. The design tokens the board needs are in place."
          builtBy="signal-dashboard prompt"
        />
      </div>
    </>
  );
}
