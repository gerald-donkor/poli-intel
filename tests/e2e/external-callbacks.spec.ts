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

  test("should fail the WhatsApp webhook verification closed when unconfigured or invalid", async ({
    request,
  }) => {
    // GET subscription handshake with invalid token
    const response = await request.get(
      "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid-token&hub.challenge=12345",
    );

    expect(response.status()).toBe(403);
  });

  test("should fail the WhatsApp webhook POST closed without valid signature", async ({
    request,
  }) => {
    const response = await request.post("/api/whatsapp/webhook", {
      data: JSON.stringify({ entry: [] }),
      headers: { "x-hub-signature-256": "sha256=invalid" },
    });

    // Returns 403 (unconfigured secret in test) or 401 (signature mismatch)
    expect([401, 403]).toContain(response.status());
  });

  test("should fail the USSD callback closed when unconfigured or path secret mismatch", async ({
    request,
  }) => {
    const response = await request.post("/api/ussd/invalid-secret", {
      form: {
        sessionId: "test-session",
        serviceCode: "*920*55#",
        phoneNumber: "+233240000000",
        text: "",
      },
    });

    expect(response.status()).toBe(403);
  });
});
