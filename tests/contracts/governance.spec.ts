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
});
