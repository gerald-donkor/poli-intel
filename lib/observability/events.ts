import type { StaffRole } from "@/lib/generated/prisma/enums";

/**
 * Usage analytics event names are kept in one allowlist so product surfaces do
 * not drift into prose names or ad hoc payloads.
 */
export const USAGE_EVENTS = {
  routeViewed: "route.viewed",
  briefGenerationRequested: "brief.generation_requested",
  briefGenerationCompleted: "brief.generation_completed",
  briefGenerationFailed: "brief.generation_failed",
  briefApprovalRefused: "brief.approval_refused",
  briefStatusChanged: "brief.status_changed",
  briefExportRequested: "brief.export_requested",
  briefExportCompleted: "brief.export_completed",
  evidenceClassificationChanged: "evidence.classification_changed",
  signalRematchRequested: "signal.rematch_requested",
  signalStatusChanged: "signal.status_changed",
  fieldSubmissionCreated: "field.submission_created",
  fieldSubmissionSyncAttempted: "field.submission_sync_attempted",
  digestWhatsappSent: "digest.whatsapp_sent",
  digestUssdViewed: "digest.ussd_viewed",
} as const;

export type UsageEventName = (typeof USAGE_EVENTS)[keyof typeof USAGE_EVENTS];

export type UsageScalar = string | number | boolean | null | undefined;

export type UsageProperties = Record<string, UsageScalar>;

export type UsageStaff = {
  id: string;
  role: StaffRole;
};
