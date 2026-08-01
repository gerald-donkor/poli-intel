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
 * `refused-unresolved-flags` and `gap` are still absent, because brief approval
 * and the Evidence Matcher are not built — shaping them speculatively is
 * over-engineering.
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
  /** A generation attempt that ended without a brief. Recorded, not swallowed. */
  | { kind: "generation-failed"; message: string };

/** The standard unauthorised refusal, so the copy is not reinvented per action. */
export function unauthorised(
  message = "You do not have permission to do that.",
): Extract<ActionRefusal, { kind: "unauthorised" }> {
  return { kind: "unauthorised", message };
}
