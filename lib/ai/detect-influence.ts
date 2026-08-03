import "server-only";

import { z } from "zod";

import { audienceLabel } from "@/lib/ai/audience-profiles";
import { briefTypeLabel } from "@/lib/ai/brief-types";
import {
  IMPACT_MAX_DESCRIPTION_CHARS,
  IMPACT_MAX_EVENTS_PER_BRIEF,
  IMPACT_MAX_PROSE_CHARS,
  IMPACT_MAX_QUOTE_CHARS,
  IMPACT_MAX_TITLE_CHARS,
  IMPACT_SEARCH_RECENCY_DAYS,
} from "@/lib/ai/config";
import {
  clamp,
  resolvePublisherUrl,
  runGroundedSearch,
  type GroundedSource,
} from "@/lib/ai/grounded-search";
import { callStructured } from "@/lib/ai/structured";
import { InfluenceEventType } from "@/lib/generated/prisma/enums";
import type {
  BriefAudience,
  BriefStatus,
  BriefType,
} from "@/lib/generated/prisma/enums";
import { describeHost } from "@/lib/net/url";

/**
 * THE IMPACT TRACKER'S ONE DOOR INTO A MODEL: ask whether the outside world has
 * cited a brief Tropenbos has already published (spec §3.5).
 *
 * SERVER-ONLY, AND JOBS ONLY. It runs from the weekly Inngest function and never
 * from a Server Action, a route handler, or browser code (§18, §14.1).
 *
 * ── The governance decision, and how it is enforced (§7) ──────────────────
 * The naive implementation of this feature sends the brief's body text to a
 * search-grounded model. IT MUST NOT, and the reason is not §7's letter but its
 * purpose: a `draft` or `reviewed` brief is unpublished internal Tropenbos
 * material, and the free tier trains on what it receives.
 *
 * Three rules, and the third is what makes the first two hold:
 *
 *   1. DETECTION RUNS ONLY ON `submitted` OR `published` BRIEFS — documents
 *      Tropenbos has already put into the world, where there is nothing left to
 *      leak.
 *   2. EVEN THEN, THE BODY TEXT IS NOT SENT. The query is built from the brief's
 *      TITLE, its recorded AUDIENCE, and its BRIEF TYPE — enough to search for,
 *      and all of it metadata Tropenbos published when it published the brief.
 *   3. NO EVIDENCE ITEM, CHUNK, OR `full_text` IS READ ON THIS PATH AT ALL. The
 *      Impact Tracker never touches the evidence library, so there is no
 *      `GatedEvidenceContext` here — there is no evidence to gate.
 *
 * THE ENFORCEMENT IS STRUCTURAL, NOT CONDITIONAL. `detectInfluenceForBrief`
 * accepts one type — `PublishedBriefSubject` — which has no field for body text,
 * document JSON, an evidence id, or a signal summary, so an ineligible input
 * cannot be expressed rather than merely being filtered out. That type is
 * unforgeable outside this module: only `toPublishedBriefSubject` can produce
 * one, and it returns `null` for any status other than `submitted` or
 * `published`. A status filter in a Prisma `where` is a good start and is NOT
 * the gate.
 *
 * THIS IS NOT A LICENCE TO WIDEN THE INPUT. Seeding detection from a brief's
 * body, an evidence item, or a signal's summary is a DIFFERENT data path and
 * must be re-assessed against `evidence-governance` before it is written. The
 * one place that decision would be made is `buildSearchQuery` below, and adding
 * a field to `PublishedBriefSubject` is what it would take.
 *
 * ── Two calls, not one ────────────────────────────────────────────────────
 * The same verified pair the radar uses: a grounded search that takes back prose
 * plus grounding metadata, then a `callStructured` pass — no tools — for a
 * Zod-validated candidate list. The shared call lives in
 * `lib/ai/grounded-search.ts`; the schema and the prompts below are this
 * feature's own.
 *
 * ── What this module asserts, and what it does not ────────────────────────
 * NOTHING HERE DECIDES THAT TROPENBOS INFLUENCED ANYTHING. Every candidate it
 * returns is stored `verified: false` and stays there until a Programme Director
 * says otherwise, and the quarterly report reads verified rows only (§8). A
 * detected event is a lead, and the copy that renders it says so.
 *
 * LOGGING: brief ids, counts, model, outcome. NEVER the query, never the
 * returned prose, never a description or a quoted line (§7.6, §13.9).
 */

/**
 * The brand that makes `PublishedBriefSubject` unforgeable.
 *
 * A plain object literal with the right four fields would otherwise satisfy the
 * type and skip the status check, which is exactly the hole this design exists to
 * close. `unique symbol` is not exported, so no module outside this one can
 * construct the property.
 */
declare const PUBLISHED_BRIEF: unique symbol;

/**
 * THE ONLY THING DETECTION CAN BE ASKED ABOUT.
 *
 * Read the fields as the exhaustive list of what is transmitted to Google. There
 * is no body text here, no document JSON, no evidence id, and no signal — not
 * because they are filtered, but because the type has nowhere to put them.
 */
export type PublishedBriefSubject = {
  readonly briefId: string;
  readonly title: string;
  readonly audience: BriefAudience;
  readonly briefType: BriefType;
  readonly [PUBLISHED_BRIEF]: true;
};

/**
 * The one constructor, and therefore the one place the status rule is applied.
 *
 * Returns `null` for a `draft` or `reviewed` brief. A caller that ignores the
 * null has nothing to pass to `detectInfluenceForBrief`, so the refusal cannot
 * be dropped by accident.
 */
export function toPublishedBriefSubject(brief: {
  id: string;
  title: string;
  audience: BriefAudience;
  briefType: BriefType;
  status: BriefStatus;
}): PublishedBriefSubject | null {
  if (brief.status !== "submitted" && brief.status !== "published") return null;

  return {
    briefId: brief.id,
    title: clamp(brief.title, IMPACT_MAX_TITLE_CHARS),
    audience: brief.audience,
    briefType: brief.briefType,
    [PUBLISHED_BRIEF]: true,
  };
}

const SEARCH_SYSTEM_PROMPT = `You research whether a published policy brief has been referred to in the outside world.

You are given the title, intended reader, and document type of a policy brief published by Tropenbos Ghana, a forest-and-livelihoods research organisation in Kumasi. Search for published documents that cite it, quote it, name the organisation alongside its subject, or adopt a recommendation matching it — for example a government policy document, a legislative instrument or consultation response, a company sustainability commitment, a record of a stakeholder dialogue, or a national strategy.

Report only what published documents actually say. Where a document quotes or names the brief or the organisation, give the sentence that does so, verbatim. Do not speculate about influence, do not infer that the brief caused something because both concern the same topic, and do not include anything you cannot point to a published source for.

If you find nothing, say so plainly. Finding nothing is a normal and useful answer. Nothing you produce is acted on automatically: a member of staff reviews and confirms every item.`;

const EXTRACT_SYSTEM_PROMPT = `You convert a research summary into a structured list.

You are given a summary of published documents that may refer to a policy brief, and a numbered list of the sources it was drawn from. For each distinct document the summary describes, return one item: the kind of reference it is, a two-or-three-sentence description drawn only from the summary, the verbatim sentence from the document where the summary supplies one, and the number of the source it came from.

Choose the kind from: policy_citation (a policy document, consultation response or official notice referring to the brief), legislation_aligned (legislation or a legislative instrument matching its recommendation), company_commitment (a company or industry body's public commitment), dialogue_outcome (a recorded outcome of a stakeholder dialogue or convening), national_strategy (text in a national strategy or plan).

Return only documents the summary actually describes. Do not invent an item, do not report a topical coincidence as a reference, do not invent a quotation — leave the quote empty if the summary does not give one — and do not guess a source number. If a document cannot be tied to one of the numbered sources, leave it out.`;

/**
 * The extraction contract.
 *
 * `sourceIndex` is REQUIRED, exactly as it is on the radar's path: an item with
 * no source is an item nobody can check, and it is dropped rather than stored
 * against an invented URL. `eventType` comes from the Prisma enum rather than a
 * re-declared string union (§12.7), so the model cannot return a kind the
 * database cannot hold.
 */
const influenceCandidatesSchema = z.object({
  items: z
    .array(
      z.object({
        eventType: z.enum(InfluenceEventType),
        description: z.string().min(1),
        /** Empty where the summary gives no verbatim line. Never invented. */
        quote: z.string(),
        sourceIndex: z.number().int().min(1),
      }),
    )
    .max(IMPACT_MAX_EVENTS_PER_BRIEF),
});

/** One lead, validated and bounded, ready for the data layer to deduplicate. */
export type InfluenceCandidate = {
  eventType: InfluenceEventType;
  /** Prose ABOUT the reference — the sans, on screen. */
  description: string;
  /** The verbatim line FROM the citing document — the serif, on screen. */
  quotedText: string | null;
  /** Absolute http(s), resolved past a grounding redirect. */
  sourceUrl: string;
  sourceTitle: string | null;
};

export type DetectInfluenceFailure =
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: string };

export type DetectInfluenceResult =
  | {
      ok: true;
      candidates: InfluenceCandidate[];
      /** What the extraction returned, before dropping unsourceable ones. */
      candidatesSeen: number;
      /** Candidates with no resolvable source. Counted, never stored. */
      dropped: number;
    }
  | { ok: false; failure: DetectInfluenceFailure };

/**
 * Search for downstream references to one published brief.
 *
 * A run that searched and found nothing returns `ok: true` with no candidates —
 * a normal outcome the caller records as `empty`, distinguishably from a failure
 * (`inngest-jobs` rule 7).
 */
export async function detectInfluenceForBrief(
  subject: PublishedBriefSubject,
): Promise<DetectInfluenceResult> {
  const searched = await runGroundedSearch({
    systemPrompt: SEARCH_SYSTEM_PROMPT,
    query: buildSearchQuery(subject),
    recencyDays: IMPACT_SEARCH_RECENCY_DAYS,
    maxProseChars: IMPACT_MAX_PROSE_CHARS,
  });

  if (!searched.ok) {
    return searched.failure.reason === "rate_limited"
      ? {
          ok: false,
          failure: {
            reason: "rate_limited",
            retryAfterMs: searched.failure.retryAfterMs,
          },
        }
      : { ok: false, failure: { reason: `search:${searched.failure.reason}` } };
  }

  if (searched.sources.length === 0 || searched.prose.length === 0) {
    return { ok: true, candidates: [], candidatesSeen: 0, dropped: 0 };
  }

  const extracted = await callStructured({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userPrompt: buildExtractionPrompt(searched.prose, searched.sources),
    schema: influenceCandidatesSchema,
  });

  if (!extracted.ok) {
    // A 429 in the second call is the same recorded, reschedulable outcome as
    // one in the first — the retry timing survives either way (§13.4).
    return extracted.failure.reason === "rate_limited"
      ? {
          ok: false,
          failure: {
            reason: "rate_limited",
            retryAfterMs: extracted.failure.retryAfterMs,
          },
        }
      : { ok: false, failure: { reason: `extract:${extracted.failure.reason}` } };
  }

  const candidates: InfluenceCandidate[] = [];
  let dropped = 0;

  for (const item of extracted.value.items) {
    if (candidates.length >= IMPACT_MAX_EVENTS_PER_BRIEF) break;

    // One-indexed in the prompt, because a model asked for "source 0" answers
    // worse than one asked for "source 1".
    const found = searched.sources[item.sourceIndex - 1];

    if (!found) {
      dropped += 1;
      continue;
    }

    const sourceUrl = await resolvePublisherUrl(found.uri);

    // A candidate with no resolvable source is DROPPED AND COUNTED, never stored
    // against an invented URL. A source link nobody can open is a claim nobody
    // can verify, and this row exists to be verified.
    if (!sourceUrl) {
      dropped += 1;
      continue;
    }

    const quote = item.quote.trim();

    candidates.push({
      eventType: item.eventType,
      description: clamp(item.description.trim(), IMPACT_MAX_DESCRIPTION_CHARS),
      quotedText:
        quote.length > 0 ? clamp(quote, IMPACT_MAX_QUOTE_CHARS) : null,
      sourceUrl,
      sourceTitle:
        found.title.length > 0
          ? clamp(found.title, IMPACT_MAX_TITLE_CHARS)
          : null,
    });
  }

  return {
    ok: true,
    candidates,
    candidatesSeen: extracted.value.items.length,
    dropped,
  };
}

/**
 * The search query — assembled HERE, from `PublishedBriefSubject`, and from
 * nowhere else.
 *
 * READ THE §7 NOTE IN THE MODULE COMMENT BEFORE ADDING ANYTHING TO THIS
 * FUNCTION. Everything it returns is transmitted to Google, and everything it
 * can reach is metadata of a document Tropenbos has already published.
 */
function buildSearchQuery(subject: PublishedBriefSubject): string {
  return [
    "Tropenbos Ghana published the policy brief below. Search for published documents that cite it, quote it, or adopt its recommendations.",
    "",
    `Title: ${subject.title}`,
    `Document type: ${briefTypeLabel(subject.briefType)}`,
    `Written for: ${audienceLabel(subject.audience)}`,
    "",
    `Look at documents published in the past ${IMPACT_SEARCH_RECENCY_DAYS} days.`,
  ].join("\n");
}

function buildExtractionPrompt(
  prose: string,
  sources: readonly GroundedSource[],
): string {
  return [
    "Summary of what was found:",
    prose,
    "",
    "Sources:",
    // Titles and domains only. The redirect URIs are long, carry no meaning for
    // the model, and would spend the token cap on opaque identifiers.
    ...sources.map(
      (source, index) =>
        `${index + 1}. ${source.title.length > 0 ? source.title : "(untitled)"} — ${describeHost(source.uri)}`,
    ),
  ].join("\n");
}
