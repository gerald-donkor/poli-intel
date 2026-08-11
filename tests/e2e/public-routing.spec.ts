import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/signals",
  "/evidence",
  "/briefs",
  "/stakeholders",
  "/tracker",
  "/impact",
  "/field",
];

test.describe("Public Routing", () => {
  test("should send an unauthenticated root request to sign in", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/signin$/);
    await expect(
      page.getByRole("heading", { name: "Sign in", level: 1 }),
    ).toBeVisible();
  });

  for (const route of protectedRoutes) {
    test(`should protect ${route} from unauthenticated access`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/signin$/);
      await expect(
        page.getByRole("heading", { name: "Sign in", level: 1 }),
      ).toBeVisible();
    });
  }

  test("should expose Google Workspace SSO as the only visible sign-in path", async ({
    page,
  }) => {
    await page.goto("/signin");

    await expect(page.getByText("EviBrief")).toBeVisible();
    await expect(
      page.getByText("Sign in with your Tropenbos Ghana Workspace account."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
    await expect(page.locator("input[type='email']")).toHaveCount(0);
    await expect(page.locator("input[type='password']")).toHaveCount(0);
    await expect(page.getByText(/magic link/i)).toHaveCount(0);
    await expect(page.getByText(/password/i)).toHaveCount(0);
  });
});
