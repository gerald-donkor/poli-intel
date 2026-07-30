import {
  EvidenceSourceType,
  ImpactArea,
} from "@/lib/generated/prisma/enums";

/**
 * Human labels for the two evidence enums, derived from the Prisma enums rather
 * than re-declared as string unions (AGENTS.md §12.7) — the record type below
 * fails to compile if a value is added to the schema and forgotten here.
 *
 * Presentation only. No taxonomy is invented; the values come from spec §4.1
 * and §3.2.
 */

export const EVIDENCE_SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  [EvidenceSourceType.field_data]: "Field data",
  [EvidenceSourceType.research]: "Research",
  [EvidenceSourceType.literature]: "Literature",
};

export const IMPACT_AREA_LABELS: Record<ImpactArea, string> = {
  [ImpactArea.restoration]: "Restoration",
  [ImpactArea.community_forestry]: "Community forestry",
  [ImpactArea.diversified_production]: "Diversified production",
  [ImpactArea.cross_cutting]: "Cross-cutting",
};

export const EVIDENCE_SOURCE_TYPE_OPTIONS = Object.values(
  EvidenceSourceType,
).map((value) => ({ value, label: EVIDENCE_SOURCE_TYPE_LABELS[value] }));

export const IMPACT_AREA_OPTIONS = Object.values(ImpactArea).map((value) => ({
  value,
  label: IMPACT_AREA_LABELS[value],
}));

/**
 * The unset option in every filter select. "Any" rather than "All": a filter
 * that is not set does not assert that everything matched, and the library only
 * ever lists what the gate allows.
 */
export const EVIDENCE_SEARCH_OPTIONS_ANY = "Any";

export function formatIngestedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
