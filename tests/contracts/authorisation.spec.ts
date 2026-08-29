import { expect, test } from "@playwright/test";

import {
  canApproveOrRejectBrief,
  canChangeEvidenceClassification,
  canDismissFlag,
  canEditBrief,
  canGenerateBrief,
  canGenerateImpactReport,
  canIngestEvidence,
  canLogInfluenceEvent,
  canManageStakeholders,
  canReclassifySignal,
  canRequestEvidenceRematch,
  canReviewEvidenceMatch,
  canSetSignalWindow,
  canSubmitFieldObservation,
  canSubmitOrPublishBrief,
  canVerifyInfluenceEvent,
} from "@/lib/auth/authorize";
import { StaffRole } from "@/lib/generated/prisma/enums";

const allRoles = Object.values(StaffRole);

function expectAllowed(
  predicate: (role: StaffRole) => boolean,
  allowedRoles: StaffRole[],
): void {
  for (const role of allRoles) {
    expect(predicate(role), role).toBe(allowedRoles.includes(role));
  }
}

test.describe("Authorisation Predicates", () => {
  test("should reserve brief approval and submission for Programme Director", () => {
    expectAllowed(canApproveOrRejectBrief, [StaffRole.programme_director]);
    expectAllowed(canSubmitOrPublishBrief, [StaffRole.programme_director]);
  });

  test("should allow only Director and Policy Officer to generate and edit briefs", () => {
    const briefAuthors = [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
    ];

    expectAllowed(canGenerateBrief, briefAuthors);
    expectAllowed(canEditBrief, briefAuthors);
  });

  test("should restrict evidence ingestion and classification to research roles", () => {
    const evidenceRoles = [
      StaffRole.programme_director,
      StaffRole.research_officer,
    ];

    expectAllowed(canIngestEvidence, evidenceRoles);
    expectAllowed(canChangeEvidenceClassification, evidenceRoles);
  });

  test("should block flag dismissal for the brief author", () => {
    const brief = { createdById: "brief-author" };
    const reviewer = "reviewer";

    expect(canDismissFlag(StaffRole.programme_director, brief, reviewer)).toBe(
      true,
    );
    expect(canDismissFlag(StaffRole.research_officer, brief, reviewer)).toBe(
      true,
    );
    expect(
      canDismissFlag(StaffRole.policy_advocacy_officer, brief, reviewer),
    ).toBe(false);
    expect(canDismissFlag(StaffRole.field_officer, brief, reviewer)).toBe(false);

    expect(
      canDismissFlag(StaffRole.programme_director, brief, "brief-author"),
    ).toBe(false);
    expect(
      canDismissFlag(StaffRole.research_officer, brief, "brief-author"),
    ).toBe(false);
  });

  test("should match signal, matcher, stakeholder, impact, and field role contracts", () => {
    expectAllowed(canReclassifySignal, [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
    ]);
    expectAllowed(canSetSignalWindow, [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
    ]);
    expectAllowed(canRequestEvidenceRematch, [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
      StaffRole.research_officer,
    ]);
    expectAllowed(canReviewEvidenceMatch, [
      StaffRole.programme_director,
      StaffRole.research_officer,
    ]);
    expectAllowed(canManageStakeholders, [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
    ]);
    expectAllowed(canLogInfluenceEvent, [
      StaffRole.programme_director,
      StaffRole.policy_advocacy_officer,
    ]);
    expectAllowed(canVerifyInfluenceEvent, [StaffRole.programme_director]);
    expectAllowed(canGenerateImpactReport, [StaffRole.programme_director]);
    expectAllowed(canSubmitFieldObservation, allRoles);
  });
});
