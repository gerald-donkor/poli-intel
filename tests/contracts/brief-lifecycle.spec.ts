import { expect, test } from "@playwright/test";

import {
  changeBriefStatusSchema,
  reopenFlagSchema,
  resolveFlagSchema,
  BRIEF_TRANSITIONS,
} from "@/app/(app)/briefs/[id]/schema";
import { saveBriefDraftSchema } from "@/app/(app)/briefs/[id]/edit/schema";
import { reframeBriefSchema } from "@/app/(app)/briefs/[id]/reframe/schema";
import { generateBriefSchema } from "@/app/(app)/briefs/new/schema";
import {
  canApproveOrRejectBrief,
  canDismissFlag,
  canEditBrief,
  canGenerateBrief,
  canSubmitOrPublishBrief,
} from "@/lib/auth/authorize";
import { parseBriefBody } from "@/lib/briefs/body";
import { diffBriefBodies } from "@/lib/briefs/diff";
import {
  BRIEF_POLICY_TEXT_MAX_CHARS,
  GENERATION_EVIDENCE_CONTEXT_SIZE,
} from "@/lib/briefs/generation-limits";
import { extractKeyMessages } from "@/lib/briefs/key-messages";
import {
  BriefAudience,
  BriefType,
  StaffRole,
} from "@/lib/generated/prisma/enums";

test.describe("Brief Lifecycle and Review Contracts", () => {
  test("enforces role boundaries for brief actions", () => {
    // Only Programme Director may approve/reject or submit/publish
    expect(canApproveOrRejectBrief(StaffRole.programme_director)).toBe(true);
    expect(canApproveOrRejectBrief(StaffRole.policy_advocacy_officer)).toBe(false);
    expect(canApproveOrRejectBrief(StaffRole.research_officer)).toBe(false);
    expect(canApproveOrRejectBrief(StaffRole.field_officer)).toBe(false);

    expect(canSubmitOrPublishBrief(StaffRole.programme_director)).toBe(true);
    expect(canSubmitOrPublishBrief(StaffRole.policy_advocacy_officer)).toBe(false);
    expect(canSubmitOrPublishBrief(StaffRole.research_officer)).toBe(false);
    expect(canSubmitOrPublishBrief(StaffRole.field_officer)).toBe(false);

    // Only Director and Policy Officer may generate or edit briefs
    expect(canGenerateBrief(StaffRole.programme_director)).toBe(true);
    expect(canGenerateBrief(StaffRole.policy_advocacy_officer)).toBe(true);
    expect(canGenerateBrief(StaffRole.research_officer)).toBe(false);
    expect(canGenerateBrief(StaffRole.field_officer)).toBe(false);

    expect(canEditBrief(StaffRole.programme_director)).toBe(true);
    expect(canEditBrief(StaffRole.policy_advocacy_officer)).toBe(true);
    expect(canEditBrief(StaffRole.research_officer)).toBe(false);
    expect(canEditBrief(StaffRole.field_officer)).toBe(false);
  });

  test("blocks flag dismissal when reviewer is the author of the brief", () => {
    const brief = { createdById: "author-user-uuid" };

    // Independent reviewer can dismiss if Programme Director or Research Officer
    expect(canDismissFlag(StaffRole.programme_director, brief, "reviewer-uuid")).toBe(true);
    expect(canDismissFlag(StaffRole.research_officer, brief, "reviewer-uuid")).toBe(true);

    // Brief author CANNOT dismiss their own flags even if they are Director or Research Officer
    expect(canDismissFlag(StaffRole.programme_director, brief, "author-user-uuid")).toBe(false);
    expect(canDismissFlag(StaffRole.research_officer, brief, "author-user-uuid")).toBe(false);

    // Policy Officer and Field Officer cannot dismiss flags in any case
    expect(canDismissFlag(StaffRole.policy_advocacy_officer, brief, "reviewer-uuid")).toBe(false);
    expect(canDismissFlag(StaffRole.field_officer, brief, "reviewer-uuid")).toBe(false);
  });

  test("parses brief body into title and structured blocks with accurate offsets", () => {
    const body = "EU Deforestation Regulation Compliance\n\nExecutive summary\nKey summary text.\n\nRecommendations\n\nMinistry of Lands\nImplement tenure reform.";
    const parsed = parseBriefBody(body);

    expect(parsed.title).toBe("EU Deforestation Regulation Compliance");
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.blocks[0].heading).toBe("Executive summary");
    expect(parsed.blocks[0].body).toBe("Key summary text.");
    expect(parsed.blocks[1].heading).toBe("Recommendations");
    expect(parsed.blocks[1].body).toBe("");
    expect(parsed.blocks[2].heading).toBe("Ministry of Lands");
    expect(parsed.blocks[2].body).toBe("Implement tenure reform.");
  });

  test("extracts key messages for translation assist", () => {
    const body = "Title\n\nExecutive summary\nMain summary for community.\n\nRecommendations\n\nForestry Commission\nProtect community boundaries.\n\nImplementation pathway\nStep one...";
    const extraction = extractKeyMessages(body);

    expect(extraction.messages).toHaveLength(2);
    expect(extraction.messages[0]).toEqual({
      kind: "executive_summary",
      heading: "Executive summary",
      text: "Main summary for community.",
    });
    expect(extraction.messages[1]).toEqual({
      kind: "recommendation",
      heading: "Forestry Commission",
      text: "Protect community boundaries.",
    });
    expect(extraction.omitted).toBe(0);
  });

  test("computes section-level diffs between brief versions", () => {
    const versionA = "Title A\n\nExecutive summary\nSummary A.\n\nRecommendations\n\nActor\nAction A.";
    const versionB = "Title B\n\nExecutive summary\nSummary B reframed.\n\nRecommendations\n\nActor\nAction A.";

    const diff = diffBriefBodies(versionA, versionB);

    expect(diff.title.status).toBe("changed");
    expect(diff.title.previous).toBe("Title A");
    expect(diff.title.next).toBe("Title B");

    expect(diff.entries).toHaveLength(3);
    expect(diff.entries[0].status).toBe("changed");
    expect(diff.entries[1].status).toBe("unchanged");
    expect(diff.entries[2].status).toBe("unchanged");
  });

  test("validates changeBriefStatusSchema transitions and reason requirements", () => {
    expect(BRIEF_TRANSITIONS).toEqual(["approve", "send_back", "submit", "publish"]);

    const validApprove = changeBriefStatusSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      transition: "approve",
    });
    expect(validApprove.success).toBe(true);

    const validSendBack = changeBriefStatusSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      transition: "send_back",
      reason: "Please update the tree tenure evidence section with Juabeso data.",
    });
    expect(validSendBack.success).toBe(true);

    // send_back without reason must be refused
    const invalidSendBackNoReason = changeBriefStatusSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      transition: "send_back",
    });
    expect(invalidSendBackNoReason.success).toBe(false);

    // Invalid transition name
    const invalidTransition = changeBriefStatusSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      transition: "auto_approve",
    });
    expect(invalidTransition.success).toBe(false);
  });

  test("validates resolveFlagSchema and reopenFlagSchema", () => {
    const validResolve = resolveFlagSchema.safeParse({
      flagId: "123e4567-e89b-12d3-a456-426614174001",
      outcome: "resolved",
      reason: "Cross-referenced with 2024 Forestry Commission report.",
    });
    expect(validResolve.success).toBe(true);

    const validDismiss = resolveFlagSchema.safeParse({
      flagId: "123e4567-e89b-12d3-a456-426614174001",
      outcome: "dismissed",
      reason: "Sentence removed from section context.",
    });
    expect(validDismiss.success).toBe(true);

    const invalidOutcome = resolveFlagSchema.safeParse({
      flagId: "123e4567-e89b-12d3-a456-426614174001",
      outcome: "ignored",
      reason: "Invalid outcome value.",
    });
    expect(invalidOutcome.success).toBe(false);

    const shortReason = resolveFlagSchema.safeParse({
      flagId: "123e4567-e89b-12d3-a456-426614174001",
      outcome: "resolved",
      reason: "no",
    });
    expect(shortReason.success).toBe(false);

    const validReopen = reopenFlagSchema.safeParse({
      flagId: "123e4567-e89b-12d3-a456-426614174001",
      reason: "New evidence contradicts this citation.",
    });
    expect(validReopen.success).toBe(true);
  });

  test("validates generateBriefSchema input bounds", () => {
    const valid = generateBriefSchema.safeParse({
      policyText: "A".repeat(250),
      briefType: BriefType.policy_brief,
      audience: BriefAudience.ghana_ministry_official,
      evidenceItemIds: ["123e4567-e89b-12d3-a456-426614174000"],
    });
    expect(valid.success).toBe(true);

    // Rejects too short policy text (< 200 chars)
    const tooShort = generateBriefSchema.safeParse({
      policyText: "Too short policy document text.",
      briefType: BriefType.policy_brief,
      audience: BriefAudience.ghana_ministry_official,
      evidenceItemIds: ["123e4567-e89b-12d3-a456-426614174000"],
    });
    expect(tooShort.success).toBe(false);

    // Rejects policy text exceeding max characters
    const tooLong = generateBriefSchema.safeParse({
      policyText: "A".repeat(BRIEF_POLICY_TEXT_MAX_CHARS + 100),
      briefType: BriefType.policy_brief,
      audience: BriefAudience.ghana_ministry_official,
      evidenceItemIds: ["123e4567-e89b-12d3-a456-426614174000"],
    });
    expect(tooLong.success).toBe(false);

    // Rejects empty evidenceItemIds
    const emptyEvidence = generateBriefSchema.safeParse({
      policyText: "A".repeat(250),
      briefType: BriefType.policy_brief,
      audience: BriefAudience.ghana_ministry_official,
      evidenceItemIds: [],
    });
    expect(emptyEvidence.success).toBe(false);

    // Rejects evidenceItemIds exceeding context size
    const excessEvidence = generateBriefSchema.safeParse({
      policyText: "A".repeat(250),
      briefType: BriefType.policy_brief,
      audience: BriefAudience.ghana_ministry_official,
      evidenceItemIds: Array.from({ length: GENERATION_EVIDENCE_CONTEXT_SIZE + 1 }, (_, i) =>
        `123e4567-e89b-12d3-a456-42661417400${i % 10}`,
      ),
    });
    expect(excessEvidence.success).toBe(false);
  });

  test("validates reframeBriefSchema and saveBriefDraftSchema", () => {
    const validReframe = reframeBriefSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      audience: BriefAudience.crema_community_governance,
    });
    expect(validReframe.success).toBe(true);

    const invalidReframeAudience = reframeBriefSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      audience: "general_public",
    });
    expect(invalidReframeAudience.success).toBe(false);

    const validDraftSave = saveBriefDraftSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      fromVersion: 1,
      document: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Draft text content." }],
          },
        ],
      },
    });
    expect(validDraftSave.success).toBe(true);

    const invalidDraftVersion = saveBriefDraftSchema.safeParse({
      briefId: "123e4567-e89b-12d3-a456-426614174000",
      fromVersion: 0,
      document: { type: "doc", content: [] },
    });
    expect(invalidDraftVersion.success).toBe(false);
  });
});
