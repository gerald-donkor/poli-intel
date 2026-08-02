import type { BriefDiff, BriefDiffEntry } from "@/lib/briefs/diff";
import { cn } from "@/lib/utils";

/**
 * What switching would change, at section altitude.
 *
 * THE ALTITUDE IS THE ARGUMENT. `brief-output` rule 4 asks the switch to read as
 * "same evidence, reframed", not "new document loaded", and a word-level diff
 * would say the opposite — every reframed sentence a field of insertions. So
 * unchanged sections are shown as unchanged and changed ones show both framings,
 * which lets a reader see that the findings and their citations held while the
 * framing moved.
 *
 * NO RED, NO GREEN. Nothing in this product is red (§11.4), and an added or
 * removed section is not a success or a failure — it is a section. Status is
 * carried by a 3px left rule, an eyebrow and a word, in the surface-tint and
 * stone families, never by a stoplight and never by colour alone (§11.13).
 *
 * THE COPY STATES WHAT MOVED AND CLAIMS NOTHING ABOUT QUALITY: "the executive
 * summary was reframed", never "a better summary for this audience" (§8.8).
 *
 * Server-rendered from a diff the action computed. It holds no state and makes
 * no decision.
 */

const STATUS_LABELS: Record<BriefDiffEntry["status"], string> = {
  unchanged: "Unchanged",
  changed: "Reframed",
  added: "New section",
  removed: "Not in the reframed draft",
};

export function ReframeDiff({
  diff,
  toAudienceLabel,
}: {
  diff: BriefDiff;
  toAudienceLabel: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="bg-card border-line rounded-card flex flex-col gap-2 border p-4 tablet:p-5">
        <h2 className="text-ink text-h3 font-semibold">
          What switching to {toAudienceLabel} would change
        </h2>
        <p className="text-ink-2 max-w-[70ch] text-[13px] leading-[1.6]">
          The same evidence set, the same policy document, reframed for a
          different reader. Nothing below has been saved — the brief is still on
          its current version until you choose.
        </p>
        <DiffSummary diff={diff} />
      </div>

      {diff.title.status === "changed" ? (
        <article className="bg-card rounded-card border-surface-tint-border border border-l-[3px] p-4 tablet:p-5">
          <Eyebrow>Title reframed</Eyebrow>
          <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 tablet:grid-cols-2">
            <Framing label="Current" body={diff.title.previous} muted />
            <Framing label="Reframed" body={diff.title.next} />
          </div>
        </article>
      ) : null}

      {diff.entries.map((entry, index) => (
        <DiffBlock key={`${entry.status}-${entry.heading}-${index}`} entry={entry} />
      ))}
    </section>
  );
}

/** The counts, in words, so the shape of the change is readable before the detail. */
function DiffSummary({ diff }: { diff: BriefDiff }) {
  const parts: string[] = [];

  if (diff.counts.changed > 0) {
    parts.push(
      `${diff.counts.changed} ${diff.counts.changed === 1 ? "section" : "sections"} reframed`,
    );
  }
  if (diff.counts.unchanged > 0) {
    parts.push(`${diff.counts.unchanged} unchanged`);
  }
  if (diff.counts.added > 0) parts.push(`${diff.counts.added} new`);
  if (diff.counts.removed > 0) {
    parts.push(`${diff.counts.removed} not carried over`);
  }

  return (
    <p className="text-ink-3 font-mono text-[11.5px] tracking-[0.02em]">
      {parts.length === 0 ? "No sections differ." : parts.join(" · ")}
    </p>
  );
}

function DiffBlock({ entry }: { entry: BriefDiffEntry }) {
  return (
    <article
      className={cn(
        "bg-card rounded-card border p-4 tablet:p-5",
        entry.status === "unchanged"
          ? "border-line"
          : entry.status === "removed"
            ? "border-line border-l-[3px] border-l-stone border-dashed"
            : "border-surface-tint-border border-l-[3px]",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-ink min-w-0 text-[15px] font-semibold">
          {entry.heading}
        </h3>
        <Eyebrow>{STATUS_LABELS[entry.status]}</Eyebrow>
      </div>

      {entry.status === "changed" ? (
        // Two framings, stacked into one column below `tablet` rather than a
        // side-by-side that overflows a phone (§11.15).
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 tablet:grid-cols-2">
          <Framing label="Current" body={entry.previousBody} muted />
          <Framing label="Reframed" body={entry.nextBody} />
        </div>
      ) : entry.body === "" ? null : (
        <div className="mt-2">
          <Prose body={entry.body} muted={entry.status !== "added"} />
        </div>
      )}
    </article>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="text-ink-3 text-meta shrink-0 font-semibold tracking-[0.06em] uppercase">
      {children}
    </span>
  );
}

function Framing({
  label,
  body,
  muted,
}: {
  label: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase">
        {label}
      </span>
      <Prose body={body} muted={muted} />
    </div>
  );
}

/**
 * Generated prose, in the SANS.
 *
 * The serif is reserved for quoted or verbatim material (§11.6). Both sides of
 * this comparison are the product's own generated text, so both are Inter —
 * setting either in the serif would say a source wrote it.
 */
function Prose({ body, muted }: { body: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex max-w-[60ch] min-w-0 flex-col gap-2 text-[13.5px] leading-[1.65]",
        muted ? "text-ink-3" : "text-ink-2",
      )}
    >
      {body.split("\n").map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
