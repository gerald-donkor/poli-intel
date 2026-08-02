import "server-only";

import {
  embedEvidenceBatch,
  embedEvidenceOnClassification,
} from "./functions/embed-evidence";
import { matchEvidenceForSignal } from "./functions/match-evidence";
import { sendMorningDigest } from "./functions/morning-digest";
import { fetchRadarSource } from "./functions/radar-fetch";
import { scheduleRadarSources } from "./functions/radar-schedule";
import { rematchEvidenceForSignal } from "./functions/rematch-evidence";
import { sweepUnembeddedEvidence } from "./functions/sweep-unembedded";

/**
 * The function registry the serve endpoint mounts.
 *
 * A function that is not in this array does not exist as far as Inngest is
 * concerned — it will never be discovered, scheduled, or triggered. Add new
 * functions here in the same change that defines them.
 */
export const inngestFunctions = [
  embedEvidenceOnClassification,
  embedEvidenceBatch,
  sweepUnembeddedEvidence,
  scheduleRadarSources,
  fetchRadarSource,
  matchEvidenceForSignal,
  rematchEvidenceForSignal,
  sendMorningDigest,
];

export { inngest } from "./client";
