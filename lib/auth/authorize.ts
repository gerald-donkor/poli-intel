import "server-only";

import { StaffRole } from "@/lib/generated/prisma/enums";
import type { Classification } from "@/lib/generated/prisma/enums";

/**
 * The AGENTS.md §10 role matrix, expressed once as named predicates.
 *
 * Every Server Action authorises its caller by calling one of these, inside the
 * action, server-side. Hiding a link or disabling a button is presentation and
 * is never the control (§10.1).
 *
 * This module is server-only and must stay unreachable from client code: no
 * role list and no predicate may appear in a shared Zod schema or anything a
 * client component can import (§10.10).
 */

/**
 * Approve, send back, or reject a brief — Programme Director only (§10.2).
 *
 * **Role alone is not sufficient.** §9.5 requires the approval action to
 * additionally re-read hallucination-guard flag state server-side and refuse
 * while any flag is unresolved. A caller that checks only this predicate has
 * silently dropped that rule.
 */
export function canApproveOrRejectBrief(role: StaffRole): boolean {
  return role === StaffRole.programme_director;
}

/** Submit or publish an approved brief — Programme Director only (§10.2). */
export function canSubmitOrPublishBrief(role: StaffRole): boolean {
  return role === StaffRole.programme_director;
}

/**
 * Generate and refine briefs (§10.3). A Policy & Advocacy Officer may generate
 * but may never approve, including their own drafts.
 */
export function canGenerateBrief(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/**
 * Edit a brief's document — §10.3's "generates and refines briefs", so the same
 * two roles that may generate one.
 *
 * A Research Officer is deliberately not here. §10.4's "annotates gaps" is real,
 * but it reads as review annotation rather than document authorship, and it
 * ships with the review work rather than being guessed at as an edit right.
 * A Field Officer has no brief surface at all (§10.5).
 *
 * ROLE ALONE IS NOT SUFFICIENT. The caller must also check the brief's own
 * state: a `submitted` or `published` brief is not editable regardless of role,
 * and that check lives in the save transaction where it cannot be raced.
 */
export function canEditBrief(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/**
 * Take a copy of a brief out of the product — the Word download.
 *
 * NOT `canEditBrief` REUSED. A Research Officer may not author a brief's
 * document but may certainly take a copy of one to check its claims against a
 * source (§10.4), so the two rights are genuinely different and sharing a
 * predicate would quietly grant or deny the wrong one. A Field Officer has no
 * brief surface at all and is refused (§10.5).
 *
 * NOT GATED ON FLAG STATE, and deliberately so. An unresolved flag blocks
 * Programme Director approval (§9.5) and nothing else; export is never blocked
 * and never silent, because the exported file carries the notice with it
 * (§16.8). Adding flag state here would invent a fifth thing a flag blocks.
 *
 * STATUS-INDEPENDENT too: a `draft` is exactly what someone needs to circulate
 * for comment, and the file states its own status so nobody has to guess.
 */
export function canExportBrief(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer ||
    role === StaffRole.research_officer
  );
}

/**
 * Manage stakeholder records (§10.3). A Field Officer has no CRM access at all
 * (§10.5).
 */
export function canManageStakeholders(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/** Ingest evidence into the knowledge base (§10.4). */
export function canIngestEvidence(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director || role === StaffRole.research_officer
  );
}

/**
 * Set or change an evidence item's classification (§10.8).
 *
 * This is the enforcement point for the governance gate's tagging rule
 * (§7.3): nothing leaves `unpublished_internal` without a caller who passes
 * here, and the change is logged with actor and timestamp.
 */
export function canChangeEvidenceClassification(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director || role === StaffRole.research_officer
  );
}

/**
 * Resolve or dismiss a hallucination-guard flag (§10.6).
 *
 * Object-level, not role-only. §10.6 states two things: dismissal is restricted
 * to Research Officer and Programme Director, *and* nobody clears a flag on a
 * brief they drafted — the rule is named for the Policy & Advocacy Officer
 * because that is the role that can draft without being able to dismiss, but a
 * reviewer marking their own work as verified is exactly what the guard exists
 * to prevent, so it holds for every role.
 *
 * The brief's author and the acting user are required arguments precisely so a
 * caller cannot accidentally perform only the role half of this check.
 */
export function canDismissFlag(
  role: StaffRole,
  brief: { createdById: string },
  actorStaffUserId: string,
): boolean {
  const roleMayDismiss =
    role === StaffRole.programme_director ||
    role === StaffRole.research_officer;

  return roleMayDismiss && brief.createdById !== actorStaffUserId;
}

/**
 * Move a signal to a different urgency on the board (§8.6, §10.3).
 *
 * The Policy & Advocacy Officer monitors signals (§10.3) and the Programme
 * Director has everything (§10.2). A Research Officer is deliberately not here:
 * their classification authority is over EVIDENCE (§10.4, §10.8), which is a
 * different taxonomy answering a different question, and a Field Officer has no
 * signal surface at all (§10.5).
 *
 * Whoever passes here, the change is written with actor and timestamp — the
 * predicate says who may, the audit row says who did (§8.6).
 */
export function canReclassifySignal(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/**
 * Record or clear the date a signal's policy window closes (§10.2, §10.3).
 *
 * MIRRORS `canReclassifySignal` DELIBERATELY, because the two controls answer the
 * same question in two different units: urgency says how soon someone should act
 * in bands, a window date says it as a day. Whoever may say "this is Immediate"
 * is whoever may say "this closes on the 14th"; splitting them would let a role
 * assert one and not the other about the same signal.
 *
 * A Research Officer is refused for the same reason they are refused
 * reclassification — their classification authority is over EVIDENCE (§10.4,
 * §10.8) — and a Field Officer has no signal surface at all (§10.5).
 *
 * NO AUDIT ROW BACKS THIS ONE, unlike reclassification. A window date is a
 * scheduling annotation, not a status transition (§8.3) and not a classification
 * (§10.8), so it does not earn a fourth audit table against the 500MB budget
 * (§12.5). `updated_at` on the signal moves; that is the whole record.
 */
export function canSetSignalWindow(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/**
 * Ask the Evidence Matcher to run again on a signal (§10.3, §10.4).
 *
 * WIDER THAN `canReclassifySignal`, and not a reuse of it. Re-matching changes
 * no classification and asserts nothing — it re-runs retrieval — and §10.4 gives
 * the Research Officer exactly this work: validating evidence matches and
 * annotating gaps. Sharing a predicate with reclassification would deny them the
 * one control their role is described by. A Field Officer is still refused
 * (§10.5).
 *
 * It costs a free-tier Gemini request, so the throttle on the job is the second
 * half of this rule (`inngest-jobs`, §13.3).
 */
export function canRequestEvidenceRematch(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer ||
    role === StaffRole.research_officer
  );
}

/**
 * Review the quality of an Evidence Matcher result against a signal.
 *
 * Restricted to Research Officer and Programme Director (spec §5.2 Research Officer workflow).
 * Distinct from `canRequestEvidenceRematch` because re-running retrieval and validating
 * retrieval quality are different permissions.
 */
export function canReviewEvidenceMatch(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.research_officer
  );
}

/**
 * See the impact record and log an influence event.
 *
 * `/impact` is the Programme Director's screen in spec §5.2's table, but the
 * Policy & Advocacy Officer is who tracks outcomes day to day — they manage
 * stakeholder relationships and follow briefs into the world (§10.3), so they
 * are the role most likely to be told at a convening that a brief was cited.
 *
 * A Research Officer is refused: §10.4 is evidence and factual accuracy, and an
 * influence record is neither. A Field Officer has no brief surface at all
 * (§10.5).
 *
 * LOGGING IS NOT VERIFYING. This predicate admits a claim to the record; the one
 * below decides whether it may go to a donor.
 */
export function canLogInfluenceEvent(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer
  );
}

/**
 * Confirm an influence event — Programme Director only.
 *
 * NARROWER THAN `canLogInfluenceEvent`, deliberately. Verification is the claim
 * that goes into a donor report, and §10.2 gives the Programme Director the
 * decisions that leave the organisation.
 *
 * ROLE-LEVEL, AND THE OBJECT-LEVEL QUESTION IS OPEN. §10.6's flag rule says
 * nobody clears a flag on a brief they drafted, and the same argument can be made
 * here: confirming an influence event on your own brief is self-attestation about
 * your own impact. It is NOT implemented as an object-level block, because
 * Tropenbos Ghana is a small organisation and a blanket rule could leave events
 * unverifiable whenever the Director wrote the brief. Instead the screen shows
 * who authored the brief on the confirmation control, so the reviewer can see
 * what they are doing.
 *
 * IF TROPENBOS WANTS THE STRICTER RULE it is a one-predicate change here, taking
 * the brief and the actor the way `canDismissFlag` does.
 */
export function canVerifyInfluenceEvent(role: StaffRole): boolean {
  return role === StaffRole.programme_director;
}

/**
 * Run the quarterly impact report — Programme Director only (§10.2).
 *
 * The report is donor-facing output about the organisation's own influence, so it
 * belongs to the role accountable for what Tropenbos says about itself. It makes
 * no Gemini call and asserts nothing beyond the rows a person already confirmed.
 */
export function canGenerateImpactReport(role: StaffRole): boolean {
  return role === StaffRole.programme_director;
}

/** Submit a field observation — open to all four roles (§10.5). */
export function canSubmitFieldObservation(role: StaffRole): boolean {
  return (
    role === StaffRole.programme_director ||
    role === StaffRole.policy_advocacy_officer ||
    role === StaffRole.research_officer ||
    role === StaffRole.field_officer
  );
}

/**
 * The typed result a Server Action returns instead of throwing across the
 * action boundary (AGENTS.md §18).
 *
 * Each variant ships with the feature that can actually produce it.
 */
export type ActionRefusal =
  | { kind: "unauthorised"; message: string }
  | { kind: "invalid"; fieldErrors: Record<string, string[]> }
  /**
   * The governance gate refused part of a selection, so the whole run was
   * refused (`lib/ai/evidence-context.ts`). Items are named by TITLE and
   * CLASSIFICATION so the officer knows what to go and fix — never by excerpt,
   * never by body text (§7.6).
   */
  | {
      kind: "refused-ineligible-classification";
      items: { id: string; title: string; classification: Classification }[];
    }
  /**
   * Approval refused because the hallucination guard still has open flags on the
   * brief's current version (§9.5). The action re-reads flag state inside its own
   * transaction and returns this; the disabled button is separate and is not the
   * control.
   *
   * It carries a COUNT, never the claims. The claims are already on screen in the
   * flag panel, and a refusal payload is one more place claim text could end up
   * in a log (§7.6).
   */
  | { kind: "refused-unresolved-flags"; openFlagCount: number }
  /**
   * A free-tier 429. Carries retry timing, and never loses what already exists
   * (§13.4). Not an error: this is normal operation on the free tier.
   */
  | { kind: "rate-limited"; retryAfterMs: number }
  /**
   * Someone else saved a new version of this document while the caller was
   * editing an older one. The caller's buffer is never discarded on the strength
   * of this — two officers in the same brief must both keep their text (§8.7).
   */
  | { kind: "version-conflict"; currentVersion: number }
  /**
   * The Evidence Matcher found nothing above the confidence threshold.
   *
   * A REAL OUTCOME, NOT AN ERROR (`evidence-matcher` rule 4). It carries the
   * signal so the caller can send the person somewhere useful — the gap empty
   * state and its next steps live on the signal detail — because "an empty panel
   * is never the answer" is the whole rule.
   *
   * The scheduled matcher does not return this: it runs in a job and records the
   * gap as an `EvidenceMatchRun` row, which is what the detail panel reads. This
   * variant is for the actions that ask for a match set and cannot proceed
   * without one.
   */
  | { kind: "gap"; signalId: string }
  /** A generation attempt that ended without a brief. Recorded, not swallowed. */
  | { kind: "generation-failed"; message: string };

/** The standard unauthorised refusal, so the copy is not reinvented per action. */
export function unauthorised(
  message = "You do not have permission to do that.",
): Extract<ActionRefusal, { kind: "unauthorised" }> {
  return { kind: "unauthorised", message };
}
