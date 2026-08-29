import { expect, test } from "@playwright/test";

import {
  scrubBreadcrumb,
  scrubEvent,
  scrubValue,
  type ScrubbableBreadcrumb,
  type ScrubbableEvent,
} from "@/lib/observability/scrub";

test.describe("Observability Scrub and Redaction Contracts", () => {
  test("preserves safe scalar metadata and technical identifiers", () => {
    expect(scrubValue(true)).toBe(true);
    expect(scrubValue(false)).toBe(false);
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(3.14159)).toBe(3.14159);
    expect(scrubValue(BigInt(100))).toBe("100n");
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();

    // Short technical strings (< 64 chars, <= 4 words)
    expect(scrubValue("123e4567-e89b-12d3-a456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(scrubValue("public_published")).toBe("public_published");
    expect(scrubValue("radar.source.scrape_failed")).toBe(
      "radar.source.scrape_failed",
    );
    expect(scrubValue("Linux 7.1.5-arch1-2")).toBe("Linux 7.1.5-arch1-2");
  });

  test("redacts evidence body prose, multiline text, and long sentences", () => {
    const syntheticFarmerObservation =
      "Farmers in Sefwi Wiawso report that new tree seedlings planted under agroforestry were damaged by wildfire.";
    expect(scrubValue(syntheticFarmerObservation)).toContain(
      "[redacted string ·",
    );

    const multilineText = "Line one\nLine two";
    expect(scrubValue(multilineText)).toContain("[redacted string ·");

    const over64CharsSingleWord = "A".repeat(65);
    expect(scrubValue(over64CharsSingleWord)).toContain("[redacted string · 65 chars]");
  });

  test("strips query parameters and fragments from telemetry URLs", () => {
    const urlWithQuery =
      "https://app.tropenbosghana.org/evidence?q=tree+tenure+rights&filter=community#details";
    expect(scrubValue(urlWithQuery)).toBe(
      "https://app.tropenbosghana.org/evidence",
    );

    const cleanUrl = "https://app.tropenbosghana.org/signals";
    expect(scrubValue(cleanUrl)).toBe("https://app.tropenbosghana.org/signals");
  });

  test("bounds object depth and array size in telemetry structures", () => {
    // Array truncation beyond 50 items
    const largeArray = Array.from({ length: 60 }, (_, i) => i);
    const scrubbedArray = scrubValue(largeArray) as unknown[];
    expect(scrubbedArray).toHaveLength(51);
    expect(scrubbedArray[50]).toContain("[redacted array tail · 10 items]");

    // Deeply nested object beyond depth 5
    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: "too deep",
              },
            },
          },
        },
      },
    };
    const scrubbedDeep = scrubValue(deepObject) as Record<string, unknown>;
    const l1 = scrubbedDeep.level1 as Record<string, unknown>;
    const l2 = l1.level2 as Record<string, unknown>;
    const l3 = l2.level3 as Record<string, unknown>;
    const l4 = l3.level4 as Record<string, unknown>;
    expect(typeof l4.level5).toBe("string");
    expect(l4.level5).toContain("[redacted object ·");
  });

  test("redacts breadcrumb messages containing quoted interpolations or long sentences", () => {
    const breadcrumb: ScrubbableBreadcrumb = {
      message: 'Fetch failed for "Confidential farmer community observation passage"',
      data: {
        status: 500,
        evidenceId: "123e4567-e89b-12d3-a456-426614174000",
      },
    };

    const scrubbed = scrubBreadcrumb(breadcrumb);
    expect(scrubbed.message).toContain("'[redacted]'");
    expect(scrubbed.message).not.toContain("Confidential farmer");
    expect(scrubbed.data).toEqual({
      status: 500,
      evidenceId: "123e4567-e89b-12d3-a456-426614174000",
    });
  });

  test("strips sensitive request details and PII from error events", () => {
    const rawEvent: ScrubbableEvent = {
      message: "Database connection timed out",
      request: {
        url: "https://app.tropenbosghana.org/api/evidence/search?q=confidential+data",
        method: "GET",
        data: { body: "Evidence body text" },
        cookies: { "authjs.session-token": "secret-session-token" },
        headers: { authorization: "Bearer secret-token" },
        query_string: "q=confidential+data",
        env: { DATABASE_URL: "postgresql://..." },
      },
      user: {
        id: "staff-uuid-1",
        role: "programme_director",
        email: "director@tropenbosghana.org",
        name: "Director Name",
        username: "director",
        ip_address: "192.168.1.1",
      },
      exception: {
        values: [
          {
            value: "Error: failed to process prompt text",
            stacktrace: {
              frames: [
                {
                  filename: "lib/ai/generate.ts",
                  abs_path: "/app/lib/ai/generate.ts",
                  lineno: 42,
                  colno: 10,
                  function: "generateBrief",
                  vars: { promptText: "Secret prompt content with evidence" },
                },
              ],
            },
          },
        ],
      },
    };

    const scrubbed = scrubEvent(rawEvent);

    // Request scrubbing
    const req = scrubbed.request as Record<string, unknown>;
    expect(req.url).toBe("https://app.tropenbosghana.org/api/evidence/search");
    expect(req.method).toBe("GET");
    expect(req.data).toBeUndefined();
    expect(req.cookies).toBeUndefined();
    expect(req.headers).toBeUndefined();
    expect(req.query_string).toBeUndefined();
    expect(req.env).toBeUndefined();

    // User PII scrubbing
    const usr = scrubbed.user as Record<string, unknown>;
    expect(usr.id).toBe("staff-uuid-1");
    expect(usr.role).toBe("programme_director");
    expect(usr.email).toBeUndefined();
    expect(usr.name).toBeUndefined();
    expect(usr.username).toBeUndefined();
    expect(usr.ip_address).toBeUndefined();

    // Exception stacktrace variables scrubbing
    const exc = scrubbed.exception as {
      values: Array<{
        value: string;
        stacktrace?: { frames: Array<Record<string, unknown>> };
      }>;
    };
    expect(exc.values[0].stacktrace?.frames[0].filename).toBe("lib/ai/generate.ts");
    expect(exc.values[0].stacktrace?.frames[0].lineno).toBe(42);
    expect(exc.values[0].stacktrace?.frames[0].vars).toBeUndefined();
  });
});
