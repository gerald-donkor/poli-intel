import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dashboardDataSource = readFileSync(
  join(process.cwd(), "lib/db/dashboard.ts"),
  "utf8",
);
const dashboardPageSource = readFileSync(
  join(process.cwd(), "app/(app)/dashboard/page.tsx"),
  "utf8",
);
const navigationSource = readFileSync(
  join(process.cwd(), "components/app-nav.tsx"),
  "utf8",
);
const sessionSource = readFileSync(
  join(process.cwd(), "lib/auth/session.ts"),
  "utf8",
);

test.describe("Executive Dashboard Contract", () => {
  test("routes each staff role to its intended landing surface", () => {
    expect(sessionSource).toContain('role === "programme_director") return "/dashboard"');
    expect(sessionSource).toContain('role === "field_officer") return "/field"');
    expect(sessionSource).toContain('return "/signals"');
  });

  test("protects the dashboard at the page boundary and uses its dedicated read model", () => {
    expect(dashboardPageSource).toContain("await requireStaffUser()");
    expect(dashboardPageSource).toContain("readExecutiveDashboardData()");
  });

  test("keeps the dashboard a bounded, metadata-only read", () => {
    expect(dashboardDataSource).toContain("APPROVAL_QUEUE_LIMIT = 12");
    expect(dashboardDataSource).toContain("URGENT_SIGNAL_LIMIT = 8");
    expect(dashboardDataSource).toContain("INFLUENCE_HIGHLIGHT_LIMIT = 6");
    expect(dashboardDataSource).not.toContain("fullText");
    expect(dashboardDataSource).not.toContain("chunkText");
    expect(dashboardDataSource).not.toContain("generateContent");
  });

  test("adds Dashboard to the global navigation", () => {
    expect(navigationSource).toContain('{ href: "/dashboard", label: "Dashboard" }');
  });
});
