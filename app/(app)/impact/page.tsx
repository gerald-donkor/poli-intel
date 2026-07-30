import { PageHeader } from "@/components/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata = {
  title: "Impact · EviBrief",
};

export default function ImpactPage() {
  return (
    <>
      <PageHeader
        title="Impact"
        subtitle="Where Tropenbos evidence has reached policy — logged influence events and the citation paths behind them."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <ScreenPlaceholder
          title="The impact map goes here"
          description="An evidence → brief → outcome lattice with drawn citation paths, plus the influence-event rail and the quarterly report generator."
          builtBy="impact-tracker prompt"
        />
      </div>
    </>
  );
}
