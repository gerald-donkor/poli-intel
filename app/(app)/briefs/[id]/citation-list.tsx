import Link from "next/link";

import type { BriefDetail } from "@/lib/db/briefs";

import { EVIDENCE_SEARCH_PARAMS } from "../../evidence/search-schema";

/**
 * The evidence this brief was generated from — the recorded set, in the order it
 * was chosen (AGENTS.md §16.5).
 *
 * SET IN THE SERIF. A citation is verbatim source material, not the product's
 * own voice, and the serif is exactly how a reader tells the two apart (§11.6).
 *
 * This is the whole factual basis of the document above it, so it is a list a
 * person can actually follow: title, authors, year, citation key, and the source
 * link where one exists. The inline citation chip that anchors a finding to a
 * row here is a Tiptap Mark and arrives with the editor prompt.
 */
export function CitationList({
  evidence,
}: {
  evidence: BriefDetail["evidence"];
}) {
  return (
    <section
      aria-labelledby="citations-heading"
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4"
    >
      <h2
        id="citations-heading"
        className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
      >
        Evidence set ({evidence.length})
      </h2>

      {evidence.length === 0 ? (
        <p className="text-ink-3 text-[13px]">
          No evidence is recorded against this brief.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {evidence.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <span className="text-ink-3 shrink-0 pt-0.5 font-mono text-[11.5px] tabular-nums">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="border-accent text-ink text-quote font-serif border-l-2 pl-3 leading-snug break-words">
                  {item.title}
                </span>
                <span className="text-ink-3 pl-3 text-[12.5px]">
                  {[
                    item.authors.length > 0 ? item.authors.join(", ") : null,
                    item.year !== null ? String(item.year) : null,
                    item.country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="flex flex-wrap items-center gap-3 pl-3">
                  <span className="text-ink-3 font-mono text-[11.5px]">
                    {item.citationKey}
                  </span>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:text-primary-hover cursor-pointer text-[12.5px] font-medium hover:underline"
                    >
                      Source
                    </a>
                  ) : null}
                  <Link
                    href={`/evidence?${EVIDENCE_SEARCH_PARAMS.query}=${encodeURIComponent(item.citationKey)}`}
                    className="text-primary hover:text-primary-hover cursor-pointer text-[12.5px] font-medium hover:underline"
                  >
                    In the library
                  </Link>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
