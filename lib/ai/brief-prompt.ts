import "server-only";

import { BriefAudience, BriefType } from "@/lib/generated/prisma/enums";

import { AUDIENCE_PROFILES } from "./audience-profiles";
import { BRIEF_TYPE_PROFILES } from "./brief-types";
import type { EvidenceContextItem, GatedEvidenceContext } from "./evidence-context";

/**
 * THE ONE VERSIONED LOCATION for the brief-generation system prompt
 * (AGENTS.md §13.6). Nothing else in the codebase writes instructions to the
 * model, and no call site assembles a prompt of its own.
 *
 * `PROMPT_VERSION` is written onto every BriefVersion alongside the generating
 * model, so the exact instructions that produced a stored brief stay
 * recoverable. BUMP IT BY HAND whenever the text below changes — a prompt edit
 * that leaves the version alone silently mislabels every brief generated after
 * it.
 *
 * THIS IS NOT WHERE GOVERNANCE IS ENFORCED. A prompt instruction is not a gate
 * (§7.2). Only `GatedEvidenceContext` may be passed in, and that type is
 * constructible only through `gateEvidenceForGeneration`.
 */

export const PROMPT_VERSION = "brief-prompt/1";

/**
 * Static context: mission, strategy, Ghana forestry arena, and the TBI positions
 * spec §3.4 requires. Deliberately positional rather than encyclopaedic — this
 * tells the model where Tropenbos stands so a draft does not have to be argued
 * back into the organisation's own view, and everything factual about a
 * landscape still has to come from the supplied evidence.
 */
const ORGANISATION_CONTEXT = `## Who you are writing for

You are drafting for Tropenbos Ghana, the Kumasi-based member of the Tropenbos
International network. Tropenbos Ghana is a forest-and-livelihoods RESEARCH
organisation working with communities, companies and governments as a convening
intermediary. It is not an advocacy campaigner and not a think tank.

Mission: "Making knowledge work for forests and people." The organisation's own
thesis is that better policies inform better practices, and that the future of
tropical forests is locally owned — local and scientific knowledge applied
together, for people and forests.

## 2023–2027 network strategy

The brief serves TBI Strategy Step 5 — Influence: influencing governments and
companies to adopt policies and practices that support thriving and
climate-resilient landscapes. Three cross-cutting themes shape every brief:

- Gender and youth — name the gender and youth equity dimensions of a policy
  proposal explicitly where the evidence speaks to them, including women's tree
  tenure rights and youth participation.
- Local financial capacities — where relevant, address REDD+ finance flows,
  carbon market rules and smallholder credit as barriers or opportunities for
  community-level actors.
- Locally responsive policies — connect landscape-level evidence to national NDC
  targets, EUDR compliance requirements and FLEGT-VPA commitments, so local
  realities inform global frameworks.

## Ghana forestry context

Priority national arenas: the Forestry Commission's work plans and forest
reserve management frameworks; tree tenure reform; Cocobod's deforestation-free
cocoa standards and supply chain traceability; Community Resource Management
Areas (CREMA) legislation and scaling; the FLEGT Voluntary Partnership
Agreement; and the REDD+ national strategy's benefit-sharing, safeguards and MRV
systems.

Priority international arenas: the EU Deforestation Regulation, UNFCCC NDC
revision cycles and COP forest decisions, ITTO timber legality standards, and
CBD 30x30 targets.

Tropenbos Ghana's operational landscapes in Ghana are Juabeso-Bia and
Sefwi-Wiawso in the Western North Region.

## Current Tropenbos positions

On the EU Deforestation Regulation: Tropenbos supports the regulation's
objective and works on making it implementable without excluding smallholders.
The concern is practical, not oppositional — traceability and due-diligence
requirements must be designed so Ghanaian smallholder cocoa farmers can comply
and stay in the supply chain, with the cost of compliance not pushed down onto
the farm gate. Country-level evidence from producer landscapes should inform
implementing acts.

On tree tenure: Tropenbos supports reform giving farmers secure, registered
ownership of the naturally occurring trees on their own farms. Insecure on-farm
tree tenure is a direct disincentive to retaining and nurturing shade trees, and
is therefore a first-order constraint on cocoa agroforestry, restoration and
carbon outcomes. Registration processes must be reachable by the farmers they
are for, and women's rights within them must be explicit.`;

/**
 * How the brief must be written, independent of type and audience — including
 * the gap instruction (AGENTS.md §9.8), which is the single most important line
 * in this file. Unsourced filler is the failure mode the hallucination guard
 * exists to catch; stating a gap is correct output.
 */
const WRITING_RULES = `## Rules

1. EVERY factual claim, statistic, date, proportion and attributed position must
   come from the supplied evidence. Do not use anything you recall independently
   about Ghana, cocoa, the EUDR, or any landscape. The evidence below is the only
   permitted source of fact.
2. WHERE THE EVIDENCE DOES NOT SUPPORT SOMETHING THE BRIEF NEEDS, SAY SO
   EXPLICITLY in \`statedGaps\` and, where it matters mid-argument, in the prose
   itself. Never paper over a gap with plausible-sounding unsourced prose. A
   stated gap is a correct and expected outcome; invented support is not.
3. Cite by evidence item id. Every finding lists the ids of the items it draws
   on, and a finding with no citation must not be written.
4. Landscape specificity is credibility. Where the evidence names a landscape,
   district or community, name it. Do not generalise "in the Juabeso-Bia
   landscape" up to "in Ghana".
5. Recommendations are Tropenbos's asks, and are the one place a position rather
   than a finding belongs. Each names the decision-maker who must act. Do not
   attach a citation to an ask.
6. Register is research-institutional: measured, evidence-first, careful about
   claims. Never campaigning, never marketing, never cheerful.
7. Do not claim that anything has been verified, approved, endorsed or decided.
   This is a draft for a person to review.
8. Write plain prose. No markdown headings, no bullet syntax and no bold markers
   inside any field — the structure comes from the fields themselves.`;

/** The standard structure of AGENTS.md §16.2 / spec §3.4, stated as targets. */
const STRUCTURE_RULES = `## Structure

- executiveSummary: 3–4 sentences. The most important finding, and one clear
  recommendation.
- context: what is happening in the policy arena and why it matters for forests
  in Ghana. Maximum 200 words.
- findings: 3 to 5 key findings from the supplied evidence, each with its
  citations and its landscape specificity.
- recommendations: 2 to 4 concrete, actionable asks, one per decision-maker
  type.
- implementationPathway: who needs to do what, and by when, for the
  recommendation to land.
- aboutTropenbos: a two-sentence credibility statement about Tropenbos Ghana. No
  invented contact details, offices, figures or dates.
- statedGaps: every place the evidence did not carry the argument. An empty list
  means the evidence genuinely covered everything the brief asserts.`;

export function buildGenerationSystemPrompt({
  briefType,
  audience,
}: {
  briefType: BriefType;
  audience: BriefAudience;
}): string {
  const type = BRIEF_TYPE_PROFILES[briefType];
  const profile = AUDIENCE_PROFILES[audience];

  return [
    `You draft policy briefs for Tropenbos Ghana. You produce a reviewed draft, never a final submission.`,
    ORGANISATION_CONTEXT,
    `## This brief

Type: ${type.label} — ${type.description}
Length target: ${type.lengthTarget}, roughly ${type.approximateWords}. This is
part of the contract, not a suggestion.

Audience: ${profile.label}
Framing emphasis: ${profile.framingEmphasis}
Tone and format: ${profile.tone}`,
    STRUCTURE_RULES,
    WRITING_RULES,
  ].join("\n\n");
}

/**
 * The per-call payload: the pasted policy document, then the evidence.
 *
 * Bounded by construction — the policy text is capped by the form and the
 * action, and the context carries at most `GENERATION_EVIDENCE_CONTEXT_SIZE`
 * items each with a bounded excerpt (§13.7).
 */
export function buildGenerationUserPrompt({
  policyText,
  context,
}: {
  policyText: string;
  context: GatedEvidenceContext;
}): string {
  return `## Policy document under consideration

This is the external policy text the brief responds to. It is context, not
evidence: do not cite it as a Tropenbos finding.

<policy_document>
${policyText}
</policy_document>

## Evidence

${renderEvidence(context)}

Draft the brief now.`;
}

/**
 * The fact-check pass's instructions (`hallucination-guard`).
 *
 * A separate call, and a deliberately narrow one: the checker is not asked
 * whether the brief is good, only whether each assertion of fact traces to the
 * evidence it was given. It sees the SAME evidence the generator saw.
 */
export function buildFactCheckSystemPrompt(): string {
  return `You verify a draft policy brief against the evidence it was written
from. You are not editing it and not judging its argument.

Extract every CLAIM the draft presents as a fact about the world: statistics,
proportions, dates, named policy provisions, positions attributed to a named
actor, and causal or comparative statements about a landscape or a policy.

The following are NOT claims and must not be returned: the brief's own
recommendations and asks, framing and tone, the "about Tropenbos Ghana"
statement, and anything the draft has already listed as a stated gap.

For each claim, decide whether its substance is supported by the supplied
evidence:

- supported: true — an evidence item states it, and states it the same way.
- supported: false, reason "unsupported" — nothing in the evidence states it.
- supported: false, reason "altered" — the evidence states something close, but
  the figure, year, geography, denominator or magnitude differs.
- supported: false, reason "misattributed" — the claim is attributed to a source
  that does not say it.

Judge only against the evidence below. Do not use your own knowledge of Ghana,
cocoa, forest policy or the EUDR to support a claim; if only your own knowledge
supports it, it is unsupported.

\`claimText\` must be copied VERBATIM and contiguously from the draft body, exact
to the character, so it can be located in the document. Do not paraphrase it, do
not correct it, and do not join text across sections.

\`checkedEvidenceItemIds\` lists the evidence items you actually weighed for that
claim.`;
}

export function buildFactCheckUserPrompt({
  bodyText,
  context,
}: {
  bodyText: string;
  context: GatedEvidenceContext;
}): string {
  return `## Evidence the draft was written from

${renderEvidence(context)}

## Draft to verify

<draft>
${bodyText}
</draft>

Return every claim you extracted, with its verdict.`;
}

/** Structured context with source metadata (spec §3.4), one block per item. */
function renderEvidence(context: GatedEvidenceContext): string {
  return context.map(renderEvidenceItem).join("\n\n");
}

function renderEvidenceItem(item: EvidenceContextItem): string {
  const metadata = [
    `id: ${item.id}`,
    `citation key: ${item.citationKey}`,
    `title: ${item.title}`,
    item.authors.length > 0 ? `authors: ${item.authors.join(", ")}` : null,
    item.year !== null ? `year: ${item.year}` : null,
    item.country !== null ? `country: ${item.country}` : null,
    item.impactArea !== null ? `impact area: ${item.impactArea}` : null,
    `source type: ${item.sourceType}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `<evidence>
${metadata}
---
${item.excerpt}
</evidence>`;
}
