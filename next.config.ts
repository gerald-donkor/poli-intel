import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Source map upload is opt-in on `SENTRY_AUTH_TOKEN`.
 *
 * A BUILD MUST NEVER FAIL FOR WANT OF A TOKEN. No Sentry organisation is
 * provisioned for this project yet, and Vercel builds today carry neither a
 * token nor a DSN — so the unconfigured path is the ordinary path. With the
 * token absent, uploading is disabled, the plugin is silenced, and the build is
 * byte-for-byte the build it was before Sentry was added.
 *
 * `telemetry: false` because the plugin's own usage reporting is a second
 * outbound channel nobody asked for on a project with a §7.6 telemetry rule.
 */
const hasAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

export default withSentryConfig(nextConfig, {
  silent: !hasAuthToken,
  telemetry: false,
  sourcemaps: { disable: !hasAuthToken },
});
