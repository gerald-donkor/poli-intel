import "server-only";

import { PostHog } from "posthog-node";

import {
  type UsageEventName,
  type UsageProperties,
  type UsageStaff,
} from "./events";
import { postHogConfig } from "./posthog-config";
import { scrubValue } from "./scrub";

let client: PostHog | null | undefined;

function postHogClient(): PostHog | null {
  if (client !== undefined) return client;

  const config = postHogConfig();

  if (!config.enabled || !config.key || !config.host) {
    client = null;

    return client;
  }

  client = new PostHog(config.key, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
    fetchRetryCount: 0,
    requestTimeout: 750,
    enableExceptionAutocapture: false,
    privacyMode: true,
    before_send: (event) =>
      event === null ? null : (scrubValue(event) as typeof event),
  });

  return client;
}

export async function captureUsage(
  event: UsageEventName,
  properties: UsageProperties = {},
  staff?: UsageStaff,
): Promise<void> {
  const config = postHogConfig();
  const analytics = postHogClient();

  if (!analytics) return;

  const safe = scrubValue({
    ...properties,
    environment: config.environment,
    release: config.release,
    actorRole: staff?.role,
  }) as Record<string, string | number | boolean | null | undefined>;

  try {
    analytics.capture({
      distinctId: staff?.id ?? "evibrief.server",
      event,
      properties: safe,
    });
    await analytics.flush();
  } catch {
    console.warn("observability.posthog.capture_failed", { event });
  }
}

export function setStaffUsageIdentity(_staff: UsageStaff): void {
  void _staff;
  // Server-side capture receives staff id and role per event. This placeholder
  // mirrors Sentry's auth boundary without creating a browser session payload or
  // person-profile identify call.
}
