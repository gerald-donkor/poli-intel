import type {
  FieldBriefCard,
  FieldDigestPayload,
  FieldSignalCard,
} from "@/lib/db/field";
import {
  BRIEF_STATUS_PLAIN_LABEL,
  URGENCY_PLAIN_LABEL,
  plainDate,
} from "@/lib/field/plain-language";

import {
  USSD_MAX_BRIEFS,
  USSD_MAX_ITEM_CHARS,
  USSD_MAX_SIGNALS,
} from "./config";
import { capScreen, toGsmSafe } from "./text";

/**
 * `readFieldDigest()`'s payload plus a keypress path → the screen a handset
 * shows.
 *
 * PURE, AND THAT IS THE POINT. No `fetch`, no Prisma, no environment, no
 * `Date.now()` — the whole menu tree is reviewable and testable without
 * credentials, a gateway account, or a network, exactly as `buildWhatsappDigest`
 * is. The route handler supplies both arguments and does nothing else.
 *
 * IT IS THE SAME ANSWER AS EVERY OTHER CHANNEL. Every screen is derived from the
 * same `readFieldDigest()` that `/field`, `/api/field/cache` and the WhatsApp
 * digest read, so a field officer never gets two different answers to "what
 * happened this week" depending on how they asked. That read is NOT widened to
 * serve this channel; if a future screen wants evidence, that is a governance
 * decision and a different prompt (§7.6).
 *
 * IT DECLARES NO LABEL OF ITS OWN. Every word describing a signal or a brief
 * comes from `lib/field/plain-language.ts`, which is where §11.12 is enforced.
 * No "signal", no "urgency", no "relevance", no classification value, no id, no
 * score.
 *
 * NOTHING HERE IMPLIES THE SYSTEM DECIDED ANYTHING (§8.8). Briefs are "Sent to
 * the people it was written for", never "approved" or "verified".
 *
 * DEPTH TWO, NO DEEPER — menu, list, item. A USSD session times out in seconds
 * and a person is holding a phone to their ear; a third level would be a maze.
 */

/**
 * `CON` keeps the session open and expects another keypress; `END` terminates
 * it. The gateway reads the prefix, so it is part of the protocol rather than
 * presentation, which is why it travels beside the body rather than glued to it.
 */
export type UssdScreen = { kind: "CON" | "END"; body: string };

/** The back key, on every list screen. */
const BACK_KEY = "0";

/** Where a walk of the keypress path has arrived. */
type Position =
  | { at: "root"; notice?: string }
  | { at: "signals" }
  | { at: "briefs" }
  | { at: "signal"; item: FieldSignalCard }
  | { at: "brief"; item: FieldBriefCard };

const NOT_AN_OPTION = "That was not one of the options.";

export function buildUssdScreen(
  payload: FieldDigestPayload,
  path: string[],
): UssdScreen {
  const signals = payload.signals.slice(0, USSD_MAX_SIGNALS);
  const briefs = payload.briefs.slice(0, USSD_MAX_BRIEFS);

  // A week with nothing in it gets an honest answer rather than a blank screen —
  // the officer dialled, and silence reads as a broken service. Ending the
  // session is right here: there is no menu to offer.
  if (signals.length === 0 && briefs.length === 0) {
    return screen("END", "There is nothing new to report this week.");
  }

  const position = walk(path, signals, briefs);

  switch (position.at) {
    case "signals":
      return listScreen({
        heading: "Policy updates:",
        empty: "There are no policy updates this week.",
        titles: signals.map((signal) => signal.title),
      });

    case "briefs":
      return listScreen({
        heading: "Papers from the office:",
        empty: "There are no new papers this week.",
        titles: briefs.map((brief) => brief.title),
      });

    case "signal":
      return screen(
        "END",
        [
          position.item.title,
          URGENCY_PLAIN_LABEL[position.item.urgency],
          position.item.summaryText,
        ].join("\n"),
      );

    case "brief":
      return screen(
        "END",
        [
          position.item.title,
          BRIEF_STATUS_PLAIN_LABEL[position.item.status],
        ].join("\n"),
      );

    case "root":
      return rootScreen(payload.generatedAt, position.notice);
  }
}

/**
 * The keypress path, walked one press at a time.
 *
 * WALKED RATHER THAN INDEXED, because the gateway accumulates every press of the
 * session into one string: a person who lists updates, presses `0` to go back and
 * then presses `2` arrives with `["1", "0", "2"]`, not `["2"]`. Reading
 * `path[0]` would send them to the wrong screen, and reading only the last press
 * would lose the level it belongs to.
 *
 * AN UNRECOGNISED PRESS RETURNS TO THE ROOT AND KEEPS THE SESSION OPEN. A
 * mistyped digit on a handset should not drop the call, so it is a notice on the
 * root menu, never an `END`.
 */
function walk(
  path: string[],
  signals: FieldSignalCard[],
  briefs: FieldBriefCard[],
): Position {
  let position: Position = { at: "root" };

  for (const key of path) {
    switch (position.at) {
      case "root":
        if (key === "1") position = { at: "signals" };
        else if (key === "2") position = { at: "briefs" };
        else position = { at: "root", notice: NOT_AN_OPTION };
        break;

      case "signals":
        position = key === BACK_KEY
          ? { at: "root" }
          : (pickSignal(signals, key) ?? { at: "root", notice: NOT_AN_OPTION });
        break;

      case "briefs":
        position = key === BACK_KEY
          ? { at: "root" }
          : (pickBrief(briefs, key) ?? { at: "root", notice: NOT_AN_OPTION });
        break;

      // A terminal screen ended the session, so the gateway sends no further
      // press. If one arrives anyway, the safe reading is a fresh start.
      default:
        position = { at: "root" };
    }
  }

  return position;
}

/**
 * A list index from a keypress, bounds-checked.
 *
 * PARSED AND RANGE-CHECKED BEFORE IT INDEXES ANYTHING. The `text` field is
 * attacker-controllable, so `"1e3"`, `"-1"`, `"007"` and `"99"` all have to
 * resolve to "not an option" rather than to an array access (§18).
 */
function indexFor(key: string, length: number): number | null {
  if (!/^[1-9][0-9]*$/.test(key)) return null;

  const index = Number.parseInt(key, 10) - 1;

  return index < length ? index : null;
}

function pickSignal(
  signals: FieldSignalCard[],
  key: string,
): Position | null {
  const index = indexFor(key, signals.length);

  return index === null ? null : { at: "signal", item: signals[index] };
}

function pickBrief(briefs: FieldBriefCard[], key: string): Position | null {
  const index = indexFor(key, briefs.length);

  return index === null ? null : { at: "brief", item: briefs[index] };
}

/**
 * The root menu: what this line can tell you, and when it was last looked at.
 *
 * The date is `plainDate`'s — the same words `/field` and the WhatsApp digest
 * use, so a person comparing two channels sees one date written one way.
 */
function rootScreen(generatedAt: string, notice?: string): UssdScreen {
  const lines = [
    `Tropenbos update ${plainDate(generatedAt)}`,
    "1. Policy updates",
    "2. Papers from the office",
  ];

  if (notice) lines.unshift(notice);

  return screen("CON", lines.join("\n"));
}

/**
 * A numbered list, each title given an equal share of the line budget.
 *
 * TRUNCATED PER ITEM RATHER THAN CUT AT THE END, so one long title cannot push
 * the third item — or the back option — off the screen entirely. Anything beyond
 * the cap was already dropped by `USSD_MAX_SIGNALS`/`USSD_MAX_BRIEFS`; the
 * escape hatch for it is the office, which the root menu names.
 */
function listScreen({
  heading,
  empty,
  titles,
}: {
  heading: string;
  empty: string;
  titles: string[];
}): UssdScreen {
  if (titles.length === 0) {
    return screen("CON", [empty, `${BACK_KEY}. Back`].join("\n"));
  }

  const lines = [
    heading,
    ...titles.map(
      (title, index) => `${index + 1}. ${capScreen(title, USSD_MAX_ITEM_CHARS)}`,
    ),
    `${BACK_KEY}. Back`,
  ];

  return screen("CON", lines.join("\n"));
}

/** Every screen leaves through here: ASCII first, then the hard character cap. */
function screen(kind: UssdScreen["kind"], body: string): UssdScreen {
  return { kind, body: capScreen(toGsmSafe(body)) };
}
