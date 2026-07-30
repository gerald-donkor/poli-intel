import { PageHeader } from "@/components/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata = {
  title: "Evidence · EviBrief",
};

export default function EvidencePage() {
  return (
    <>
      <PageHeader
        title="Evidence"
        subtitle="The research corpus — searchable by keyword and meaning, filtered by country, year, impact area, and source type."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <ScreenPlaceholder
          title="The evidence library goes here"
          description="Filters, the results table with relevance scores, the detail panel, and the classification queue every newly ingested item waits in."
          builtBy="evidence-ingestion and evidence-library prompts"
        />
      </div>
    </>
  );
}
