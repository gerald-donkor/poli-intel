/**
 * PostHog configuration for EviBrief.
 *
 * The product spec names PostHog as self-hosted analytics. That means a project
 * key alone is not enough: omitting a host must disable analytics rather than
 * falling back to PostHog Cloud. Autocapture and replay are also deliberately
 * off because either can collect DOM text, form values, or URLs that contain
 * evidence search text.
 */

export type PostHogConfig = {
  enabled: boolean;
  key: string | null;
  host: string | null;
  environment: string;
  release: string | null;
};

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export function postHogConfig(): PostHogConfig {
  const key = clean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const host = clean(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  return {
    enabled: key !== null && host !== null,
    key,
    host,
    environment: clean(process.env.VERCEL_ENV) ?? clean(process.env.NODE_ENV) ?? "development",
    release: clean(process.env.VERCEL_GIT_COMMIT_SHA),
  };
}
