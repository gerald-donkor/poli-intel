import "server-only";

import { z } from "zod";

import type { Classification } from "@/lib/generated/prisma/enums";
import {
  partitionByClassification,
  type GateRefusal,
} from "@/lib/governance/gate";

import {
  MATCHER_CANDIDATE_ITEMS,
  MATCHER_RERANK_EXCERPT_CHARS,
} from "./config";
import { callStructured, type StructuredCallFailure } from "./structured";

/**
 * THE RERANK DOOR — step 4 of the fixed retrieval order.
 *
 * Cosine similarity over a 512-token chunk ranks PASSAGES, not documents: a
 * paragraph that happens to share vocabulary with a signal can outrank a study
 * that actually answers it. The rerank is the second, semantically richer pass
 * that `evidence-matcher` rule 1 puts between the top 20 and the top 8.
 *
 * A SUBSTITUTION, RECORDED AS ONE. Rule 1 says "cross-encoder rerank". There is
 * no cross-encoder reranking endpoint on the Gemini free tier, so this is an LLM
 * reranker: ONE structured call scoring all 20 candidates, not 20 calls. It
 * preserves the rule's purpose and cannot preserve its mechanism on this stack.
 * See the note in `.claude/skills/evidence-matcher/SKILL.md`.
 *
 * THE GATE. This module exposes no function that accepts raw evidence. The only
 * way in is `gateCandidatesForRerank`, which calls `partitionByClassification`
 * itself and bounds every excerpt on the way through, so a caller cannot forget
 * the gate — there is no unchecked way to build the argument (§7.2).
 *
 * FILTER, NOT WHOLE-RUN REFUSAL — deliberately unlike
 * `gateEvidenceForGeneration`. There, an officer chose the set by hand and
 * silently generating from a different one is the defect. Here the set is
 * machine-selected from a query that already filtered on classification, so a
 * refusal can only mean an item was reclassified between the query and the
 * call. Dropping those candidates and recording the count is honest; refusing
 * the whole run would turn one officer's reclassification into a matcher
 * outage. Nothing ineligible reaches the model either way.
 *
 * LOGGING: refusals carry ids and classifications only. No title, no excerpt, no
 * body text leaves here (§7.6, §13.9).
 */

/** What one candidate contributes to the rerank call. */
export type RerankItem = {
  /**
   * The evidence item's id, named `id` because that is the field the gate
   * judges — `GateCandidate` is `{ id, classification }` and a candidate type
   * that renamed it would need a translation step the gate could be forgotten
   * on either side of.
   */
  id: string;
  citationKey: string;
  title: string;
  year: number | null;
  country: string | null;
  /** Bounded at `MATCHER_RERANK_EXCERPT_CHARS`. Never the whole chunk. */
  excerpt: string;
  similarity: number;
};

/** What the gate is handed: the candidate, plus the one field it judges. */
export type RerankCandidate = Omit<RerankItem, "excerpt"> & {
  classification: Classification;
  chunkText: string;
};

declare const rerankBrand: unique symbol;

/**
 * A candidate set that has passed the classification gate. The brand is
 * unforgeable outside this module, so `as GatedRerankCandidates` is the only way
 * to fake one — and that is a deliberate act, not an oversight.
 */
export type GatedRerankCandidates = readonly RerankItem[] & {
  readonly [rerankBrand]: true;
};

export type RerankGateOutcome = {
  candidates: GatedRerankCandidates;
  /** Reclassified between the query and the call. Counted on the run row. */
  refused: GateRefusal[];
};

/** The only constructor. Partitions, bounds each excerpt, keeps the order. */
export function gateCandidatesForRerank(
  candidates: readonly RerankCandidate[],
): RerankGateOutcome {
  const { eligible, refused } = partitionByClassification(candidates);

  const gated = eligible
    .slice(0, MATCHER_CANDIDATE_ITEMS)
    .map(toRerankItem) as unknown as GatedRerankCandidates;

  return { candidates: gated, refused };
}

function toRerankItem(candidate: RerankCandidate): RerankItem {
  const text = candidate.chunkText.trim();

  return {
    id: candidate.id,
    citationKey: candidate.citationKey,
    title: candidate.title,
    year: candidate.year,
    country: candidate.country,
    similarity: candidate.similarity,
    excerpt:
      text.length > MATCHER_RERANK_EXCERPT_CHARS
        ? `${text.slice(0, MATCHER_RERANK_EXCERPT_CHARS).trimEnd()}…`
        : text,
  };
}

/**
 * One score per candidate the model chose to return.
 *
 * `citationKey` is the handle rather than the internal id: it is what the
 * excerpts are labelled with, and it keeps database uuids out of the prompt and
 * the completion. A key the model invents is dropped by the caller.
 *
 * `reason` is one line, and it is stored nowhere — it exists so the model has to
 * justify a score to itself, which is what stops a flat run of 0.8s.
 */
const rerankResponseSchema = z.object({
  scores: z.array(
    z.object({
      citationKey: z.string().min(1),
      relevance: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
});

export type RerankScore = {
  citationKey: string;
  relevance: number;
};

export type RerankResult =
  | { ok: true; scores: RerankScore[]; model: string }
  | { ok: false; failure: StructuredCallFailure };

const SYSTEM_PROMPT = `You score evidence for Tropenbos Ghana, a forest-and-livelihoods research organisation in Kumasi. Its work covers cocoa agroforestry, tree tenure and land rights, restoration of degraded land, community forest management, wildfire prevention, and alternative livelihoods. Its operational landscapes are Juabeso-Bia and Sefwi-Wiawso in Ghana's Western North Region. Its recurring policy concerns are EUDR compliance, tree tenure reform, cocoa-sector sustainability, and forest governance.

You are given one policy signal and a numbered list of candidate evidence excerpts already retrieved by vector similarity. Similarity found passages that read alike. Your job is the harder question: would this evidence actually support a policy brief responding to this signal?

Score each candidate from 0 to 1:
  0.8-1.0  directly evidences a claim a brief on this signal would need to make
  0.5-0.79 relevant supporting context, or the right topic in a different landscape
  0.2-0.49 same broad subject, but would not carry a claim
  0.0-0.19 retrieved on surface vocabulary; not usable here

Reward evidence specific to the signal's actual subject and to Ghanaian landscapes. Do not reward length, recency, or confident phrasing on their own.

Return a score for EVERY candidate, identified by the citation key exactly as given. Do not invent a citation key, do not return a candidate that was not listed, and do not recommend anything — a member of staff reviews every match you score.`;

/**
 * Score the gated candidates against the signal in one structured call.
 *
 * The signal summary is the whole query text — it is a normalised two-or-three
 * sentence description written at classification time, which is exactly what a
 * reranker should read.
 *
 * Output is Zod-validated and retried once by `callStructured`, then becomes a
 * typed `invalid_output` failure the caller records. Never persisted
 * unvalidated (§9.4, §13.8).
 */
export async function rerankEvidenceCandidates({
  signalSummary,
  candidates,
}: {
  signalSummary: string;
  candidates: GatedRerankCandidates;
}): Promise<RerankResult> {
  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(signalSummary, candidates),
    schema: rerankResponseSchema,
  });

  if (!result.ok) return { ok: false, failure: result.failure };

  return {
    ok: true,
    scores: result.value.scores.map((score) => ({
      citationKey: score.citationKey,
      relevance: score.relevance,
    })),
    model: result.model,
  };
}

function buildUserPrompt(
  signalSummary: string,
  candidates: GatedRerankCandidates,
): string {
  const blocks = candidates.map((item) =>
    [
      `Citation key: ${item.citationKey}`,
      `Title: ${item.title}`,
      item.year === null ? null : `Year: ${item.year}`,
      item.country === null ? null : `Country: ${item.country}`,
      `Excerpt: ${item.excerpt}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );

  return [
    "Policy signal:",
    signalSummary,
    "",
    `Candidate evidence (${candidates.length}):`,
    blocks.join("\n\n"),
  ].join("\n");
}
