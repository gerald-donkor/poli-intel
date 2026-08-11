"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

import {
  USAGE_EVENTS,
  type UsageEventName,
  type UsageProperties,
} from "./events";
import type { PostHogConfig } from "./posthog-config";
import { scrubValue } from "./scrub";

let initialised = false;

function safeProperties(properties: UsageProperties): Record<string, unknown> {
  return scrubValue(properties) as Record<string, unknown>;
}

function initPostHog(config: PostHogConfig): boolean {
  if (!config.enabled || !config.key || !config.host) return false;
  if (initialised) return true;

  try {
    posthog.init(config.key, {
      api_host: config.host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_performance: false,
      disable_capture_url_hashes: true,
      save_referrer: false,
      save_campaign_params: false,
      mask_all_element_attributes: true,
      mask_all_text: true,
      mask_personal_data_properties: true,
      person_profiles: "never",
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      advanced_disable_toolbar_metrics: true,
      disable_scroll_properties: true,
      before_send: (event) =>
        event === null ? null : (scrubValue(event) as typeof event),
      loaded: (client) => {
        client.set_config({
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
        });
      },
    });
    posthog.stopSessionRecording();
    initialised = true;

    return true;
  } catch {
    return false;
  }
}

function captureClientUsage(
  config: PostHogConfig,
  event: UsageEventName,
  properties: UsageProperties,
): void {
  if (!initPostHog(config)) return;

  try {
    posthog.capture(event, safeProperties(properties));
  } catch {
    // Analytics transport must never affect hydration or navigation.
  }
}

export function PostHogProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: PostHogConfig;
}) {
  return (
    <>
      <PostHogRouteCapture config={config} />
      {children}
    </>
  );
}

function PostHogRouteCapture({ config }: { config: PostHogConfig }) {
  const pathname = usePathname();

  useEffect(() => {
    captureClientUsage(config, USAGE_EVENTS.routeViewed, {
      pathname,
      environment: config.environment,
      release: config.release,
    });
  }, [config, pathname]);

  return null;
}
