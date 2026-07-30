// Its own description, so the root layout's — which uses internal vocabulary —
// is not inherited into this surface's document head.
export const metadata = {
  title: "This week · EviBrief",
  description: "Your weekly update from the office, saved for offline reading.",
};

export default function FieldPage() {
  return (
    <>
      <header className="bg-primary flex flex-col gap-3 px-5 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-surface-tint size-[18px] rounded-[2px] border-2"
          />
          <span className="text-surface-tint text-[13px] font-semibold tracking-[0.12em] uppercase">
            EviBrief
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-semibold text-white">This week</h1>
          <p className="text-surface-tint text-[14px]">
            Your weekly update from the office.
          </p>
        </div>
      </header>

      {/* Offline state is shown, never silent (AGENTS.md §17.2, §17.4). Wired to
          real connectivity in the field-officer prompt; static chrome for now. */}
      <div className="bg-stone border-line flex items-center gap-2 border-b px-5 py-3">
        <span
          aria-hidden="true"
          className="bg-ink-disabled size-2 shrink-0 rounded-full"
        />
        <p className="text-ink-2 text-[14px]">
          Showing saved updates when you are offline.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="bg-card border-line rounded-card border p-4">
          <p className="text-ink text-[14px] leading-relaxed">
            Your updates and the things to act on will appear here as cards, one
            message each.
          </p>
          <p className="text-ink-3 mt-2 font-mono text-[11.5px]">
            Built by the field-officer prompt
          </p>
        </div>
      </div>

      <footer className="border-line flex flex-col gap-2 border-t px-4 py-4">
        <button
          type="button"
          disabled
          className="bg-primary rounded-card min-h-[48px] w-full px-4 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          Send an update from the field
        </button>
        <p className="text-ink-3 text-center text-[14px]">
          Works offline — sends when you are back online.
        </p>
      </footer>
    </>
  );
}
