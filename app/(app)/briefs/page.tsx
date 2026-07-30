import { PageHeader } from "@/components/page-header";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata = {
  title: "Briefs · EviBrief",
};

export default function BriefsPage() {
  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="Drafts, submissions, and position papers. Every draft is reviewed by a person before it leaves the building."
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <ScreenPlaceholder
          title="The brief list and editor go here"
          description="A list of drafts by status, then the Tiptap editor with citation chips, the audience switcher, and the review panel."
          builtBy="brief-generator and brief-editor prompts"
        />
      </div>
    </>
  );
}
