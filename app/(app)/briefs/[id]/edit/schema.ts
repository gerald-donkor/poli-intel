import { z } from "zod";

import { briefDocumentSchema } from "@/lib/briefs/document";

/**
 * An autosave's shape, shared by the editor and `saveBriefDraft`
 * (AGENTS.md §10.10).
 *
 * SHAPE ONLY — this module ships to the browser. Who may edit is answered
 * server-side by `canEditBrief`; whether the brief is still editable and whether
 * the version is current are answered inside the save transaction, where they
 * cannot be raced. Neither question is answerable here, and neither may be
 * encoded here.
 *
 * The document is validated against the known node vocabulary before it is
 * stored: `documentJson` is rendered back into a rich-text surface, and an
 * unvalidated blob from a client is exactly how that becomes an injection
 * vector. An unrecognised node type is rejected, not stored.
 */
export const saveBriefDraftSchema = z.object({
  briefId: z.uuid(),
  /** The version the editor opened from. A stale one is refused, not merged. */
  fromVersion: z.number().int().min(1),
  document: briefDocumentSchema,
});

export type SaveBriefDraftInput = z.infer<typeof saveBriefDraftSchema>;
