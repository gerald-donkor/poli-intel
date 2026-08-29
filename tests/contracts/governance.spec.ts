import { expect, test } from "@playwright/test";

import {
  ELIGIBLE_EVIDENCE_WHERE,
  PENDING_CLASSIFICATION,
  partitionByClassification,
} from "@/lib/governance/gate";
import { Classification } from "@/lib/generated/prisma/enums";

test.describe("Evidence Governance", () => {
  test("should partition public evidence from ineligible classifications", () => {
    const candidates = [
      {
        id: "public-evidence",
        classification: Classification.public_published,
        body: "synthetic public body must remain only on eligible item",
      },
      {
        id: "community-evidence",
        classification: Classification.community_sourced,
        body: "synthetic community body must not appear in refusal",
      },
      {
        id: "internal-evidence",
        classification: Classification.unpublished_internal,
        body: "synthetic internal body must not appear in refusal",
      },
    ];

    const result = partitionByClassification(candidates);

    expect(result.eligible).toEqual([candidates[0]]);
    expect(result.refused).toEqual([
      {
        id: "community-evidence",
        classification: Classification.community_sourced,
        reason: "ineligible_classification",
      },
      {
        id: "internal-evidence",
        classification: Classification.unpublished_internal,
        reason: "ineligible_classification",
      },
    ]);
  });

  test("should keep refusal records free of evidence prose", () => {
    const { refused } = partitionByClassification([
      {
        id: "community-evidence",
        classification: Classification.community_sourced,
        title: "Synthetic community title",
        body: "Synthetic community observation text",
        excerpt: "Synthetic excerpt",
      },
    ]);

    expect(refused).toHaveLength(1);
    expect(Object.keys(refused[0]).sort()).toEqual([
      "classification",
      "id",
      "reason",
    ]);
  });

  test("should expose the retrieval filter and pending classification constants", () => {
    expect(ELIGIBLE_EVIDENCE_WHERE).toEqual({
      classification: Classification.public_published,
    });
    expect(PENDING_CLASSIFICATION).toBe(Classification.unpublished_internal);
  });

  test("should grant gated context when all candidates are public published", async () => {
    const { gateEvidenceForGeneration } = await import(
      "@/lib/ai/evidence-context"
    );
    const { GENERATION_EVIDENCE_EXCERPT_CHARS } = await import(
      "@/lib/ai/config"
    );

    const longText = "x".repeat(GENERATION_EVIDENCE_EXCERPT_CHARS + 500);
    const shortText = "Synthetic short evidence body.";

    const candidates = [
      {
        id: "ev-1",
        title: "Study on Agroforestry",
        authors: ["Author A", "Author B"],
        year: 2024,
        country: "Ghana",
        impactArea: "Forest Governance",
        sourceType: "Report",
        citationKey: "Author2024",
        classification: Classification.public_published,
        fullText: longText,
      },
      {
        id: "ev-2",
        title: "Tree Tenure Assessment",
        authors: ["Author C"],
        year: 2023,
        country: "Ghana",
        impactArea: "Land Tenure",
        sourceType: "Journal",
        citationKey: "Author2023",
        classification: Classification.public_published,
        fullText: shortText,
      },
    ];

    const outcome = gateEvidenceForGeneration(candidates);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.context).toHaveLength(2);

      expect(outcome.context[0].id).toBe("ev-1");
      expect(outcome.context[0].title).toBe("Study on Agroforestry");
      expect(outcome.context[0].authors).toEqual(["Author A", "Author B"]);
      expect(outcome.context[0].year).toBe(2024);
      expect(outcome.context[0].country).toBe("Ghana");
      expect(outcome.context[0].impactArea).toBe("Forest Governance");
      expect(outcome.context[0].sourceType).toBe("Report");
      expect(outcome.context[0].citationKey).toBe("Author2024");
      expect(outcome.context[0].excerpt.endsWith("…")).toBe(true);
      expect(outcome.context[0].excerpt.length).toBeLessThanOrEqual(
        GENERATION_EVIDENCE_EXCERPT_CHARS + 1,
      );

      expect(outcome.context[1].id).toBe("ev-2");
      expect(outcome.context[1].excerpt).toBe(shortText);
    }
  });

  test("should enforce whole-run refusal if any candidate is ineligible", async () => {
    const { gateEvidenceForGeneration } = await import(
      "@/lib/ai/evidence-context"
    );

    const candidates = [
      {
        id: "ev-public",
        title: "Public Brief",
        authors: ["Author A"],
        year: 2024,
        country: "Ghana",
        impactArea: "Forest Governance",
        sourceType: "Report",
        citationKey: "Author2024",
        classification: Classification.public_published,
        fullText: "Public text",
      },
      {
        id: "ev-community",
        title: "Community Field Record",
        authors: ["Officer B"],
        year: 2024,
        country: "Ghana",
        impactArea: "Community Rights",
        sourceType: "Field Report",
        citationKey: "Officer2024",
        classification: Classification.community_sourced,
        fullText: "Confidential community record",
      },
    ];

    const outcome = gateEvidenceForGeneration(candidates);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refused).toEqual([
        {
          id: "ev-community",
          classification: Classification.community_sourced,
          reason: "ineligible_classification",
        },
      ]);
      expect(Object.keys(outcome.refused[0]).sort()).toEqual([
        "classification",
        "id",
        "reason",
      ]);
    }
  });

  test("should refuse all items when every candidate is ineligible", async () => {
    const { gateEvidenceForGeneration } = await import(
      "@/lib/ai/evidence-context"
    );

    const candidates = [
      {
        id: "ev-internal",
        title: "Internal Draft",
        authors: ["Staff 1"],
        year: 2024,
        country: "Ghana",
        impactArea: "Forest Governance",
        sourceType: "Internal Note",
        citationKey: "Staff2024",
        classification: Classification.unpublished_internal,
        fullText: "Draft notes",
      },
      {
        id: "ev-community",
        title: "Community Observation",
        authors: ["Field Officer"],
        year: 2024,
        country: "Ghana",
        impactArea: "Land Tenure",
        sourceType: "Observation",
        citationKey: "Field2024",
        classification: Classification.community_sourced,
        fullText: "Farmer quotes",
      },
    ];

    const outcome = gateEvidenceForGeneration(candidates);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refused).toHaveLength(2);
      expect(outcome.refused[0]).toEqual({
        id: "ev-internal",
        classification: Classification.unpublished_internal,
        reason: "ineligible_classification",
      });
      expect(outcome.refused[1]).toEqual({
        id: "ev-community",
        classification: Classification.community_sourced,
        reason: "ineligible_classification",
      });
    }
  });
});
