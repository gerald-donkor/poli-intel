import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const targetPort = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- -H 127.0.0.1 -p ${targetPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && targetPort === "3000",
    timeout: 120_000,
    env: {
      NODE_OPTIONS: "",
      NODE_ENV: "test",
      AUTH_SECRET: "test-secret-do-not-use-in-production",
      AUTH_URL: baseURL,
      AUTH_GOOGLE_ID: "test-google-client-id",
      AUTH_GOOGLE_SECRET: "test-google-client-secret",
      AUTH_ALLOWED_DOMAIN: "tropenbosghana.org",
      DATABASE_URL: "postgresql://evibrief_test:evibrief_test@127.0.0.1:5432/evibrief_test",
      DIRECT_URL: "postgresql://evibrief_test:evibrief_test@127.0.0.1:5432/evibrief_test",
    },
  },
});
