import { BriefAudience, BriefStatus, Urgency } from "@/lib/generated/prisma/enums";

export const URGENCY_LABELS: Record<Urgency, string> = {
  [Urgency.immediate]: "Immediate",
  [Urgency.near_term]: "Near-term",
  [Urgency.horizon]: "Horizon",
  [Urgency.watch]: "Watch",
};

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  [BriefStatus.draft]: "Draft",
  [BriefStatus.reviewed]: "Reviewed",
  [BriefStatus.submitted]: "Submitted",
  [BriefStatus.published]: "Published",
};

export const BRIEF_AUDIENCE_LABELS: Record<BriefAudience, string> = {
  [BriefAudience.ghana_ministry_official]: "Ghana Ministry",
  [BriefAudience.cocoa_company_sustainability]: "Cocoa Company",
  [BriefAudience.eu_regulator]: "EU Regulator",
  [BriefAudience.donor_programme_officer]: "Donor / Programme Officer",
  [BriefAudience.crema_community_governance]: "Community Governance / CREMA",
};
