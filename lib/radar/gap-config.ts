import { DIGEST_RECIPIENT_ROLES } from "@/lib/digest/config";

export const RADAR_GAP_CRON = "0 7 * * 1";
export const RADAR_GAP_SEND_HOUR_UTC = 7;
export const RADAR_GAP_SEND_MINUTE_UTC = 0;
export const RADAR_GAP_WINDOW_DAYS = 7;

export const RADAR_GAP_RECIPIENT_ROLES = DIGEST_RECIPIENT_ROLES;

export function radarGapWindowFor(now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  end.setUTCHours(RADAR_GAP_SEND_HOUR_UTC, RADAR_GAP_SEND_MINUTE_UTC, 0, 0);

  const start = new Date(
    end.getTime() - RADAR_GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  return { start, end };
}

export function radarGapWeekKey(end: Date): string {
  return end.toISOString().slice(0, 10);
}

export function radarGapIdempotencyKey(
  staffUserId: string,
  weekKey: string,
): string {
  return `radar-gap/${staffUserId}/${weekKey}`;
}
