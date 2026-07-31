import "server-only";

import { z } from "zod";

import type { BriefAudience, BriefType } from "@/lib/generated/prisma/enums";

import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  PROMPT_VERSION,
} from "./brief-prompt";
import type { GatedEvidenceContext } from "./evidence-context";
import {
  callStructured,
  type StructuredCallFailure,
} from "./structured";

/**
 * THE GENERATION DOOR.
 *
 * There is exactly one way in, and it takes `GatedEvidenceContext` — a type
 * whose only constructor runs the classification gate
 * (`lib/ai/evidence-context.ts`). No overload takes evidence rows, ids, or raw
 * text, so there is no unchecked path to forget (AGENTS.md §7.2).
 *
 * The output is Zod-validated before it leaves this module. Nothing downstream
 * ever sees an unvalidated model response (§9.4, §13.8).
 *
 * LOGGING: nothing here logs the prompt, the completion, or evidence text
 * (§7.6, §13.9).
 */

/**
 * The generated brief's shape (spec §3.4 / AGENTS.md §16.2 structure).
 *
 * `citations` are evidence item ids so the citation list can resolve them back
 * to real rows — a citation the reader cannot follow is not traceability.
 */
const briefDraftShape = z.object({
  title: z.string().min(1),
  executiveSummary: z.string().min(1),
  context: z.string().min(1),
  findings: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        citations: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  recommendations: z
    .array(
      z.object({
        ask: z.string().min(1),
        decisionMaker: z.string().min(1),
      }),
    )
    .min(1),
  implementationPathway: z.string().min(1),
  aboutTropenbos: z.string().min(1),
  /** Empty is a valid answer; a fabricated absence of gaps is not (§9.8). */
  statedGaps: z.array(z.string()),
});

export type BriefDraft = z.infer<typeof briefDraftShape>;

/**
 * The schema the request is built from is the shape above; the schema the
 * RESPONSE is validated against additionally requires every citation to name an
 * item that was actually supplied.
 *
 * A citation pointing at evidence the generator was never given is a fabricated
 * source, and this product's whole proposition is that a reader can follow every
 * citation to a real item. So it is treated as invalid output — retried once,
 * then a recorded failure — rather than quietly dropped, which would leave a
 * finding standing on a citation the reader never sees.
 */
function draftSchemaFor(context: GatedEvidenceContext) {
  const allowedIds = new Set(context.map((item) => item.id));

  return briefDraftShape.superRefine((draft, ctx) => {
    draft.findings.forEach((finding, index) => {
      for (const citation of finding.citations) {
        if (allowedIds.has(citation)) continue;

        ctx.addIssue({
          code: "custom",
          path: ["findings", index, "citations"],
          message: "Citation names evidence that was not supplied.",
        });
      }
    });
  });
}

export type GenerateBriefResult =
  | {
      ok: true;
      draft: BriefDraft;
      generatingModel: string;
      promptVersion: string;
    }
  | { ok: false; failure: StructuredCallFailure };

export async function generateBrief({
  briefType,
  audience,
  policyText,
  context,
}: {
  briefType: BriefType;
  audience: BriefAudience;
  policyText: string;
  context: GatedEvidenceContext;
}): Promise<GenerateBriefResult> {
  const result = await callStructured({
    systemPrompt: buildGenerationSystemPrompt({ briefType, audience }),
    userPrompt: buildGenerationUserPrompt({ policyText, context }),
    schema: draftSchemaFor(context),
  });

  if (!result.ok) return { ok: false, failure: result.failure };

  return {
    ok: true,
    draft: result.value,
    generatingModel: result.model,
    promptVersion: PROMPT_VERSION,
  };
}

/**
 * The stored `bodyText` — the draft rendered into the §16.2 order, once, so the
 * document a person reads, the document the fact-check pass verifies, and the
 * document a flag's character offsets index into are all the same string.
 *
 * Deterministic and pure: the same draft always yields the same text, which is
 * what makes an anchor computed here still valid every time the body is
 * re-rendered.
 *
 * THE BLOCK CONTRACT, which `parseBriefBody` in `lib/briefs/body.ts` is the
 * inverse of — change one and you must change the other:
 *
 *   - Blocks are separated by ONE BLANK LINE.
 *   - A block of a single line is a heading with no body of its own: the
 *     document title, or a section divider.
 *   - A block of two or more lines is a heading (line 1) plus its prose (the
 *     rest).
 *
 * That is enough structure to render a document without a second copy of it in
 * a JSON column, and `BriefVersion.documentJson` accordingly stays null until
 * the editor prompt builds the Tiptap document from this same text.
 */
export function assembleBodyText(draft: BriefDraft): string {
  const blocks: string[] = [
    line(draft.title),
    `Executive summary\n${prose(draft.executiveSummary)}`,
    `Context\n${prose(draft.context)}`,
    "Evidence",
    ...draft.findings.map(
      (finding) => `${line(finding.heading)}\n${prose(finding.body)}`,
    ),
    "Recommendations",
    ...draft.recommendations.map(
      (recommendation) =>
        `${line(recommendation.decisionMaker)}\n${prose(recommendation.ask)}`,
    ),
    `Implementation pathway\n${prose(draft.implementationPathway)}`,
    `About Tropenbos Ghana\n${prose(draft.aboutTropenbos)}`,
  ];

  // Stated gaps are part of the document, not a footnote to it: where the
  // evidence did not carry the argument, the brief says so (§9.8).
  if (draft.statedGaps.length > 0) {
    blocks.push(`Evidence gaps\n${draft.statedGaps.map(line).join("\n")}`);
  }

  return blocks.join("\n\n");
}

/**
 * A heading is one line. A model that emitted a newline inside one would
 * otherwise split a block in two and turn its second half into a heading of its
 * own.
 */
function line(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Prose keeps its paragraph breaks as SINGLE newlines. A blank line inside a
 * field would be read back as a block boundary by `parseBriefBody`, so the
 * separator stays reserved for the assembler.
 */
function prose(text: string): string {
  return text
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n");
}

/** Re-validates a draft read back out of the attempt row's JSON column. */
export function parseStoredDraft(value: unknown): BriefDraft | null {
  const parsed = briefDraftShape.safeParse(value);

  return parsed.success ? parsed.data : null;
}
