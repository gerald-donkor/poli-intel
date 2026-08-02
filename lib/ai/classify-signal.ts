import "server-only";

import { z } from "zod";

import type { DetectedItem } from "@/lib/radar/extract";
import {
  AudienceTarget,
  Geography,
  ImpactArea,
  Relevance,
  Urgency,
} from "@/lib/generated/prisma/enums";

import { RADAR_MAX_DOCUMENT_CHARS } from "./config";
import { callStructured, type StructuredCallFailure } from "./structured";

/**
 * THE SIGNAL-CLASSIFICATION DOOR.
 *
 * This is call type 3 in `evidence-governance` — "signal urgency / relevance /
 * impact-area / geography / audience scoring" — so the gate applies, and it is
 * satisfied STRUCTURALLY rather than asserted:
 *
 *   `classifySignal` accepts a `DetectedItem` and nothing else. A `DetectedItem`
 *   is produced only by `lib/radar/extract.ts` from a fetched public document,
 *   and there is NO parameter here that can carry an `EvidenceItem`, an evidence
 *   id, or a chunk. Evidence is not merely filtered out of this call — it is
 *   unrepresentable in its input.
 *
 * That is why this door has no `partitionByClassification` call and returns no
 * refusals: there is nothing for the gate to partition, because there is no path
 * by which evidence arrives. Making evidence unrepresentable is the strongest
 * form of the same rule, not an exemption from it (AGENTS.md §7.2).
 *
 * A fetched policy document is the SUBJECT of a signal, never evidence. Nothing
 * on this path writes to `evidence_item`, reads a classification, or touches a
 * chunk.
 *
 * LOGGING: nothing here logs the document, the prompt, or the completion
 * (§7.6, §13.9).
 */

/**
 * The five classification fields, plus the summary that becomes the signal's
 * `summary_text`.
 *
 * The summary rides along in the SAME structured call rather than being a
 * second request or a truncation of the fetched page. `summary_text` is
 * non-nullable, it is what a reviewer reads on the board, and it is what the
 * signal's embedding is derived from — a normalised two-sentence summary
 * embeds meaningfully, whereas the first 400 characters of a listing page
 * embeds that page's navigation. One call, no extra budget.
 *
 * Enum values come from the Prisma enums, never a re-declared string union
 * (AGENTS.md §12.7), so a schema change cannot leave this asking for a value
 * the database cannot hold.
 */
const signalClassificationSchema = z.object({
  summary: z.string().min(1),
  urgency: z.enum(Urgency),
  relevance: z.enum(Relevance),
  impactArea: z.enum(ImpactArea),
  geography: z.enum(Geography),
  audienceTarget: z.enum(AudienceTarget),
});

export type SignalClassification = z.infer<typeof signalClassificationSchema>;

export type ClassifySignalResult =
  | { ok: true; classification: SignalClassification; model: string }
  | { ok: false; failure: StructuredCallFailure };

/**
 * Tropenbos context, so the model judges relevance against this organisation's
 * actual mandate rather than against forest policy in the abstract.
 *
 * The enum meanings are spec §3.2's own definitions. They are stated because
 * the value names alone do not carry them — nothing in the string `horizon`
 * says "3–6 months", and a model guessing at that boundary would produce a
 * board that sorts by nothing in particular.
 */
const SYSTEM_PROMPT = `You classify policy signals for Tropenbos Ghana, a forest-and-livelihoods research organisation in Kumasi working under the position that the future of tropical forests is locally owned.

Its work: cocoa agroforestry, tree tenure and land rights, restoration of degraded land, community forest management, wildfire prevention, alternative livelihoods, and gender and youth as drivers of change. Its operational landscapes are Juabeso-Bia and Sefwi-Wiawso in Ghana's Western North Region. Its recurring policy concerns are EUDR compliance, tree tenure reform, cocoa-sector sustainability, and forest governance.

You are given one document detected by automated monitoring of a public source. Classify it, and summarise it. You are not deciding anything: a member of staff reviews every signal you classify.

urgency — how soon a response would have to be made:
  immediate: a window closing in under 4 weeks
  near_term: 1-3 months
  horizon: 3-6 months
  watch: more than 6 months away, or no window yet

relevance — to Tropenbos Ghana's mandate above:
  core: directly about its work or landscapes
  adjacent: affects its work indirectly
  background: context worth knowing, no direct bearing

impactArea:
  restoration, community_forestry, diversified_production, cross_cutting

geography:
  ghana_national, cocoa_belt_landscapes, international, multi_level

audienceTarget — who a response would have to reach:
  ministry, cocobod, eu_institutions, private_sector, community_governance

summary — two or three plain sentences: what the document is, what it would change, and by when. State only what the document says. Do not infer a deadline that is not stated, and do not recommend anything.`;

export async function classifySignal(
  item: DetectedItem,
): Promise<ClassifySignalResult> {
  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(item),
    schema: signalClassificationSchema,
  });

  return result.ok
    ? { ok: true, classification: result.value, model: result.model }
    : { ok: false, failure: result.failure };
}

/**
 * Bounded a second time here, independently of the extractor's own cap. Two
 * modules cap this because they are capping it for different reasons — the
 * extractor bounds what a hostile page can put in memory, this bounds what
 * reaches a model — and neither should rely on the other having done it.
 */
function buildUserPrompt(item: DetectedItem): string {
  return [
    `Source: ${item.sourceName}`,
    `URL: ${item.url}`,
    `Title: ${item.title}`,
    item.publishedAt ? `Published: ${item.publishedAt.toISOString()}` : null,
    "",
    "Document text:",
    item.text.slice(0, RADAR_MAX_DOCUMENT_CHARS),
  ]
    .filter((line) => line !== null)
    .join("\n");
}
