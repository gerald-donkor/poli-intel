import { expect, test } from "@playwright/test";

import type {
  FieldBriefCard,
  FieldDigestPayload,
  FieldSignalCard,
} from "@/lib/db/field";
import {
  BriefStatus,
  Urgency,
} from "@/lib/generated/prisma/enums";
import { buildUssdScreen } from "@/lib/ussd/menu";
import {
  WHATSAPP_UNKNOWN_SENDER_REPLY,
  buildWhatsappDigest,
} from "@/lib/whatsapp/message";

function makeSyntheticPayload(options: {
  signals?: FieldSignalCard[];
  briefs?: FieldBriefCard[];
  generatedAt?: string;
}): FieldDigestPayload {
  return {
    generatedAt: options.generatedAt ?? "2026-08-29T10:00:00.000Z",
    signals: options.signals ?? [
      {
        id: "signal-1",
        title: "EU Deforestation Regulation (EUDR) Implementation Rules",
        urgency: Urgency.immediate,
        summaryText: "EU issues updated guidance on cocoa traceability compliance.",
        sourceName: "European Commission",
        detectedAt: "2026-08-28T09:00:00.000Z",
      },
      {
        id: "signal-2",
        title: "Parliamentary Hearing on Tree Tenure Reform",
        urgency: Urgency.near_term,
        summaryText: "Select Committee schedules deliberations on tenure rights.",
        sourceName: "Parliament of Ghana",
        detectedAt: "2026-08-27T14:00:00.000Z",
      },
    ],
    briefs: options.briefs ?? [
      {
        id: "brief-1",
        title: "Cocoa Agroforestry Policy Recommendations",
        status: BriefStatus.submitted,
        updatedAt: "2026-08-28T16:00:00.000Z",
      },
      {
        id: "brief-2",
        title: "Community Forest Governance Guide",
        status: BriefStatus.published,
        updatedAt: "2026-08-26T11:00:00.000Z",
      },
    ],
  };
}

test.describe("Messaging and Fallback Digest Contracts", () => {
  test("builds WhatsApp digest with plain language labels and no internal IDs or scores", () => {
    const payload = makeSyntheticPayload({});
    const message = buildWhatsappDigest(payload);

    expect(message).toContain("Tropenbos weekly update — 29 August 2026");
    expect(message).toContain("What is happening in policy:");
    expect(message).toContain("EU Deforestation Regulation (EUDR) Implementation Rules");
    expect(message).toContain("Act this month");
    expect(message).toContain("Parliamentary Hearing on Tree Tenure Reform");
    expect(message).toContain("Coming in the next few months");

    expect(message).toContain("Papers the office has written:");
    expect(message).toContain("Cocoa Agroforestry Policy Recommendations");
    expect(message).toContain("Sent to the people it was written for");
    expect(message).toContain("Community Forest Governance Guide");
    expect(message).toContain("Published");

    // Proves no internal IDs, classification values, or relevance scores appear
    expect(message).not.toContain("signal-1");
    expect(message).not.toContain("brief-1");
    expect(message).not.toContain("public_published");
    expect(message).not.toContain("relevance");
    expect(message).not.toContain("score");
  });

  test("handles empty payload honestly for WhatsApp digest", () => {
    const emptyPayload = makeSyntheticPayload({ signals: [], briefs: [] });
    const message = buildWhatsappDigest(emptyPayload);

    expect(message).toContain("Tropenbos weekly update — 29 August 2026");
    expect(message).toContain("There is nothing new to report this week.");
  });

  test("provides neutral and non-committal WhatsApp reply for unknown senders", () => {
    expect(WHATSAPP_UNKNOWN_SENDER_REPLY).toBe(
      "Thanks for your message. This number sends policy updates to registered Tropenbos field officers only, and it cannot take replies or reports. Please contact the Tropenbos Ghana office directly.",
    );
  });

  test("builds USSD root screen with CON session kind", () => {
    const payload = makeSyntheticPayload({});
    const screen = buildUssdScreen(payload, []);

    expect(screen.kind).toBe("CON");
    expect(screen.body).toContain("Tropenbos update 29 August 2026");
    expect(screen.body).toContain("1. Policy updates");
    expect(screen.body).toContain("2. Papers from the office");
  });

  test("walks USSD menu path to policy updates list and detail item", () => {
    const payload = makeSyntheticPayload({});

    // Menu option 1: Policy updates list
    const listScreen = buildUssdScreen(payload, ["1"]);
    expect(listScreen.kind).toBe("CON");
    expect(listScreen.body).toContain("Policy updates:");
    expect(listScreen.body).toContain("1. EU Deforestation");
    expect(listScreen.body).toContain("0. Back");

    // Menu option 1 -> 1: Detail of first policy update
    const detailScreen = buildUssdScreen(payload, ["1", "1"]);
    expect(detailScreen.kind).toBe("END");
    expect(detailScreen.body).toContain("Act this month");
    expect(detailScreen.body).toContain("EU issues updated guidance");

    // Back option returns to root menu
    const backScreen = buildUssdScreen(payload, ["1", "0"]);
    expect(backScreen.kind).toBe("CON");
    expect(backScreen.body).toContain("1. Policy updates");
  });

  test("walks USSD menu path to papers list and detail item", () => {
    const payload = makeSyntheticPayload({});

    // Menu option 2: Papers from office
    const listScreen = buildUssdScreen(payload, ["2"]);
    expect(listScreen.kind).toBe("CON");
    expect(listScreen.body).toContain("Papers from the office:");
    expect(listScreen.body).toContain("1. Cocoa Agroforestry");
    expect(listScreen.body).toContain("0. Back");

    // Menu option 2 -> 1: Detail of first paper
    const detailScreen = buildUssdScreen(payload, ["2", "1"]);
    expect(detailScreen.kind).toBe("END");
    expect(detailScreen.body).toContain("Sent to the people it was written for");
  });

  test("handles invalid USSD keypresses without dropping call", () => {
    const payload = makeSyntheticPayload({});
    const screen = buildUssdScreen(payload, ["99"]);

    expect(screen.kind).toBe("CON");
    expect(screen.body).toContain("That was not one of the options.");
    expect(screen.body).toContain("1. Policy updates");
  });

  test("handles empty payload with terminal END screen for USSD", () => {
    const emptyPayload = makeSyntheticPayload({ signals: [], briefs: [] });
    const screen = buildUssdScreen(emptyPayload, []);

    expect(screen.kind).toBe("END");
    expect(screen.body).toBe("There is nothing new to report this week.");
  });
});
