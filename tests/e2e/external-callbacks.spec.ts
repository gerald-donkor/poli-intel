import { expect, test } from "@playwright/test";

test.describe("External Callback Failures", () => {
  test("should fail the field cache closed for signed-out callers", async ({
    request,
  }) => {
    const response = await request.get("/api/field/cache");

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("should fail the Google Drive consent route closed for signed-out callers", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/google-drive?briefId=test");

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("text/plain");
  });

  test("should fail the Google Drive callback closed for signed-out callers", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/auth/google-drive/callback?state=test",
    );

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("text/plain");
  });
});
