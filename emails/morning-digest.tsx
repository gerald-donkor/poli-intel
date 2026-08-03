import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";

import type { Urgency } from "@/lib/generated/prisma/enums";

/**
 * The morning digest.
 *
 * IT CARRIES NO EVIDENCE, EVER. Signal titles and generated summary prose,
 * brief type / audience / status / open-flag counts, and integer counts. No
 * evidence title, no chunk text, no matched excerpt, no citation key. The
 * enforcement is structural and lives in `lib/db/digest.ts`, which selects no
 * column from `evidence_item` or `evidence_chunk` at all — there is no field on
 * these props for one to arrive through (AGENTS.md §7.6).
 *
 * IT LINKS, AND NEVER ACTS. Every item is a link into the app, where the reader
 * signs in and the Server Actions authorise them. Nothing here advances a
 * signal, approves a brief, or clears a flag — no action links, no one-click
 * approve, not behind a token (§8.2, §8.3, §10.1).
 *
 * NO IMAGES, NO WEB FONTS, NO TRACKING PIXEL. Low bandwidth is a stated
 * requirement (spec §3.2), and it also means there is no leaf, tree or forest
 * imagery to get wrong (§11.7).
 *
 * WHY THE PROPS ARE PRE-LABELLED: everything role-dependent, ordered, or
 * enum-derived is decided in `lib/digest/build.ts`, so this file imports one
 * type and nothing else. That keeps `npm run email` able to render it outside
 * Next.js, and keeps the ordering decision (§11.4 — the urgency ramp's order
 * carries the taxonomy) next to the table it is read from rather than buried in
 * a template.
 */

export type DigestSignalView = {
  id: string;
  title: string;
  /** Generated prose from the classification call — the sans, never the serif. */
  summaryText: string;
  sourceName: string;
  detectedAt: string;
  relevanceLabel: string;
};

/** One urgency section, already in ramp order. Nothing here re-sorts them. */
export type DigestUrgencyGroup = {
  urgency: Urgency;
  label: string;
  window: string;
  signals: DigestSignalView[];
};

export type DigestBriefView = {
  id: string;
  title: string;
  briefTypeLabel: string;
  audienceLabel: string;
  statusLabel: string;
  openFlagCount: number;
};

/**
 * One new influence event. TITLES AND LABELS ONLY — no description, and above
 * all no quoted line from a citing document. The section says something happened
 * and links to the screen where it can be read (§7.6).
 */
export type DigestInfluenceView = {
  id: string;
  briefId: string;
  briefTitle: string;
  eventTypeLabel: string;
  detectionMethodLabel: string;
  verified: boolean;
};

export type MorningDigestProps = {
  recipientName: string;
  /** "the 24 hours to 06:30 UTC on 2 August 2026" — the window, said plainly. */
  windowLabel: string;
  appUrl: string;
  signalGroups: DigestUrgencyGroup[];
  signalCount: number;
  signalsTruncated: boolean;
  radar: { sourcesChecked: number; sourcesFailed: number };
  /** `null` where this recipient's role does not receive the section. */
  briefs: DigestBriefView[] | null;
  briefsTruncated: boolean;
  /** `null` where this recipient's role does not receive the section. */
  classificationQueueCount: number | null;
  /** `null` where this recipient's role does not receive the section. */
  influence: DigestInfluenceView[] | null;
  influenceTruncated: boolean;
};

/**
 * The palette, mirrored from the `@theme` block in `app/globals.css`.
 *
 * A second copy is unavoidable — an email cannot read a CSS custom property, and
 * every client that matters strips `:root`. It is the only copy: the ramp below
 * is written once here and the template refers to token names, never to hex.
 *
 * Every pairing used below clears 4.5:1 against `card`: immediate 5.35,
 * nearterm 4.91, horizon 5.4, watch 6.1, ink-3 5.15 (§11.13).
 */
const palette = {
  primary: "#0f6e56",
  "primary-ink": "#0b5644",
  "surface-tint": "#e1f5ee",
  "surface-tint-border": "#bfdfd3",
  paper: "#f7f5f0",
  card: "#fdfcf9",
  stone: "#efece4",
  line: "#e4e1d8",
  ink: "#2c2c2a",
  "ink-2": "#444441",
  "ink-3": "#6b6b66",
  immediate: "#8a6032",
  nearterm: "#67743c",
  horizon: "#0f6e56",
  watch: "#496375",
};

const theme = {
  presets: [pixelBasedPreset],
  theme: { extend: { colors: palette } },
};

/**
 * `Hr` ships a hard-coded `border-top: 1px solid #eaeaea`, which lands after any
 * `border-*` utility and wins. An inline top border is the only way to keep the
 * divider on the product's own line colour, and it reads `palette` rather than
 * repeating a hex.
 */
const RULE_STYLE = { borderTop: `1px solid ${palette.line}` };

/**
 * The ramp's classes, written out in full per stage.
 *
 * URGENCY IS A 3px LEFT RULE AND A SMALL-CAPS EYEBROW, AND NOTHING ELSE — never
 * a filled row, which is what keeps the list readable at density (§11.5). Never
 * red, amber or green: this is politically sensitive material and a stoplight
 * reads wrong to a diplomatic audience (§11.4).
 *
 * The enum's `near_term` maps to the `nearterm` token; this table is the one
 * place those two spellings meet, exactly as `app/(app)/signals/labels.ts` says.
 */
const URGENCY_RULE: Record<Urgency, { rule: string; eyebrow: string }> = {
  immediate: { rule: "border-l-immediate", eyebrow: "text-immediate" },
  near_term: { rule: "border-l-nearterm", eyebrow: "text-nearterm" },
  horizon: { rule: "border-l-horizon", eyebrow: "text-horizon" },
  watch: { rule: "border-l-watch", eyebrow: "text-watch" },
};

export default function MorningDigest({
  recipientName,
  windowLabel,
  appUrl,
  signalGroups,
  signalCount,
  signalsTruncated,
  radar,
  briefs,
  briefsTruncated,
  classificationQueueCount,
  influence,
  influenceTruncated,
}: MorningDigestProps) {
  return (
    <Html lang="en">
      <Tailwind config={theme}>
        <Head />
        <Body className="bg-paper font-sans text-ink m-0 p-0">
          {/*
            Says what the morning holds, rather than repeating the subject — and
            `Preview` emits the document's `<title>` from the same string, so a
            second `<title>` in `Head` would only be a duplicate that says less.
          */}
          <Preview>
            {previewLine(
              signalCount,
              briefs,
              classificationQueueCount,
              influence,
            )}
          </Preview>

          <Container className="mx-auto w-full max-w-[600px] p-[16px]">
            <Section className="mb-[16px]">
              <Text className="text-ink-3 m-0 text-[12px] uppercase tracking-[0.06em]">
                EviBrief · Policy Radar
              </Text>
              <Heading
                as="h1"
                className="text-ink m-0 mt-[4px] text-[22px] leading-[1.3] font-semibold"
              >
                Morning digest
              </Heading>
              <Text className="text-ink-3 m-0 mt-[6px] text-[13px] leading-[1.5]">
                {recipientName}, this covers {windowLabel}.
              </Text>
            </Section>

            <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

            <Section className="mb-[8px]">
              <Heading
                as="h2"
                className="text-ink m-0 text-[16px] leading-[1.4] font-semibold"
              >
                {signalHeading(signalCount)}
              </Heading>
              <Text className="text-ink-3 m-0 mt-[4px] text-[12px] leading-[1.5]">
                {radarLine(radar)}
              </Text>
            </Section>

            {signalGroups.map((group) => (
              <Section key={group.urgency} className="mb-[16px]">
                <Text
                  className={`m-0 mb-[6px] text-[12px] uppercase tracking-[0.06em] ${URGENCY_RULE[group.urgency].eyebrow}`}
                >
                  {group.label} · {group.window}
                </Text>

                {group.signals.map((signal) => (
                  <Section
                    key={signal.id}
                    className={`bg-card border-line mb-[8px] rounded-[6px] border-0 border-l-[3px] border-solid p-[12px] ${URGENCY_RULE[group.urgency].rule}`}
                  >
                    <Text className="m-0 text-[15px] leading-[1.4] font-semibold">
                      <Link
                        href={`${appUrl}/signals/${signal.id}`}
                        className="text-primary-ink no-underline"
                      >
                        {signal.title}
                      </Link>
                    </Text>
                    <Text className="text-ink-2 m-0 mt-[6px] text-[14px] leading-[1.6]">
                      {signal.summaryText}
                    </Text>
                    <Text className="text-ink-3 m-0 mt-[8px] text-[12px] leading-[1.4]">
                      {signal.sourceName} · {signal.detectedAt} ·{" "}
                      {signal.relevanceLabel} relevance
                    </Text>
                  </Section>
                ))}
              </Section>
            ))}

            {signalsTruncated ? (
              <Text className="text-ink-3 m-0 mb-[16px] text-[12px] leading-[1.5]">
                More were recorded than are listed here. The board holds the
                rest.
              </Text>
            ) : null}

            <Section className="mb-[16px]">
              <Link
                href={`${appUrl}/signals`}
                className="text-primary text-[14px] underline"
              >
                Open the signal board
              </Link>
            </Section>

            {briefs !== null ? (
              <>
                <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

                <Section className="mb-[8px]">
                  <Heading
                    as="h2"
                    className="text-ink m-0 text-[16px] leading-[1.4] font-semibold"
                  >
                    {briefsHeading(briefs.length)}
                  </Heading>
                </Section>

                {briefs.map((brief) => (
                  <Section
                    key={brief.id}
                    className="bg-card border-line mb-[8px] rounded-[6px] border border-solid p-[12px]"
                  >
                    <Text className="m-0 text-[15px] leading-[1.4] font-semibold">
                      <Link
                        href={`${appUrl}/briefs/${brief.id}`}
                        className="text-primary-ink no-underline"
                      >
                        {brief.title}
                      </Link>
                    </Text>
                    <Text className="text-ink-3 m-0 mt-[6px] text-[12px] leading-[1.4]">
                      {brief.briefTypeLabel} · {brief.audienceLabel} ·{" "}
                      {brief.statusLabel}
                    </Text>
                    {brief.openFlagCount > 0 ? (
                      /* A flag is a review prompt, not an error — the watch ramp,
                         never red, never an alarm (§9.7). A round glyph, because a
                         square is the classification hold (§11.7). */
                      <Text className="text-watch m-0 mt-[8px] text-[12px] leading-[1.4]">
                        {flagLine(brief.openFlagCount)}
                      </Text>
                    ) : null}
                  </Section>
                ))}

                {briefsTruncated ? (
                  <Text className="text-ink-3 m-0 mb-[8px] text-[12px] leading-[1.5]">
                    More are waiting than are listed here.
                  </Text>
                ) : null}

                <Section className="mb-[16px]">
                  <Link
                    href={`${appUrl}/briefs`}
                    className="text-primary text-[14px] underline"
                  >
                    Open the briefs list
                  </Link>
                </Section>
              </>
            ) : null}

            {influence !== null && influence.length > 0 ? (
              <>
                <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

                <Section className="mb-[8px]">
                  <Heading
                    as="h2"
                    className="text-ink m-0 text-[16px] leading-[1.4] font-semibold"
                  >
                    {influenceHeading(influence.length)}
                  </Heading>
                  <Text className="text-ink-3 m-0 mt-[4px] text-[12px] leading-[1.5]">
                    Nothing here has been established as influence. Each entry is
                    a record waiting to be read and confirmed.
                  </Text>
                </Section>

                {influence.map((event) => (
                  <Section
                    key={event.id}
                    className="bg-card border-line mb-[8px] rounded-[6px] border border-solid p-[12px]"
                  >
                    <Text className="m-0 text-[15px] leading-[1.4] font-semibold">
                      <Link
                        href={`${appUrl}/briefs/${event.briefId}`}
                        className="text-primary-ink no-underline"
                      >
                        {event.briefTitle}
                      </Link>
                    </Text>
                    <Text className="text-ink-3 m-0 mt-[6px] text-[12px] leading-[1.4]">
                      {event.eventTypeLabel} · {event.detectionMethodLabel}
                    </Text>
                    {/* SHAPE AND WORDS, NOT COLOUR (§11.13). A lozenge, filled
                        or hollow, so it is neither the guard flag's circle nor
                        the classification hold's square (§11.7) — and no urgency
                        ramp, because an influence event has no urgency. */}
                    <Text
                      className={`m-0 mt-[8px] text-[12px] leading-[1.4] ${event.verified ? "text-primary-ink" : "text-ink-3"}`}
                    >
                      {event.verified
                        ? "◆ Confirmed by a person"
                        : "◇ Not yet confirmed"}
                    </Text>
                  </Section>
                ))}

                {influenceTruncated ? (
                  <Text className="text-ink-3 m-0 mb-[8px] text-[12px] leading-[1.5]">
                    More were recorded than are listed here.
                  </Text>
                ) : null}

                <Section className="mb-[16px]">
                  <Link
                    href={`${appUrl}/impact`}
                    className="text-primary text-[14px] underline"
                  >
                    Open the impact record
                  </Link>
                </Section>
              </>
            ) : null}

            {classificationQueueCount !== null ? (
              <>
                <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

                <Section className="border-surface-tint-border bg-surface-tint mb-[16px] rounded-[6px] border border-solid p-[12px]">
                  <Heading
                    as="h2"
                    className="text-primary-ink m-0 text-[14px] leading-[1.4] font-semibold"
                  >
                    {/* A SQUARE glyph: the classification hold, distinct from the
                        guard flag's circle above (§11.7). */}
                    ■ Evidence awaiting classification
                  </Heading>
                  <Text className="text-primary-ink m-0 mt-[6px] text-[14px] leading-[1.6]">
                    {classificationQueueCount === 0
                      ? "The queue is empty."
                      : `${classificationQueueCount} item${classificationQueueCount === 1 ? " is" : "s are"} waiting to be tagged. Until an item is tagged it is not searchable and cannot be used in a brief.`}
                  </Text>
                  {classificationQueueCount > 0 ? (
                    <Text className="m-0 mt-[8px] text-[14px] leading-[1.4]">
                      <Link
                        href={`${appUrl}/evidence/queue`}
                        className="text-primary underline"
                      >
                        Open the classification queue
                      </Link>
                    </Text>
                  ) : null}
                </Section>
              </>
            ) : null}

            <Hr style={RULE_STYLE} className="m-0 mb-[12px] border-0" />

            <Text className="text-ink-3 m-0 text-[12px] leading-[1.5]">
              Sent by EviBrief for Tropenbos Ghana. Everything above is a record
              of what was picked up and what is waiting — no signal has been
              acted on and no brief has been approved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/**
 * The heading, in the digest's register: what was PICKED UP, never what needs
 * the reader's attention (§8.8 — the system reports, it does not prioritise).
 */
function signalHeading(count: number): string {
  if (count === 0) return "No new signals were recorded";

  return `${count} signal${count === 1 ? " was" : "s were"} recorded`;
}

/** What the radar did, so "quiet" and "broken" are told apart (§14.7). */
function radarLine({
  sourcesChecked,
  sourcesFailed,
}: {
  sourcesChecked: number;
  sourcesFailed: number;
}): string {
  const checked = `${sourcesChecked} source${sourcesChecked === 1 ? " was" : "s were"} checked`;

  if (sourcesFailed === 0) return `${checked}, all reachable.`;

  return `${checked}; ${sourcesFailed} could not be reached, so ${sourcesFailed === 1 ? "its" : "their"} news may be missing.`;
}

/** Waiting on a decision — never "ready", and never "needs your attention". */
function briefsHeading(count: number): string {
  if (count === 0) return "No briefs are waiting on a decision";

  return `${count} brief${count === 1 ? "" : "s"} waiting on a decision`;
}

/**
 * What an open flag means, in the guard's own register: the claim needs a
 * person's eyes, never that it is wrong (`hallucination-guard`). It also states
 * the consequence, because unresolved flags block approval server-side (§9.5).
 */
function flagLine(openFlagCount: number): string {
  return `● Waiting on checks — ${openFlagCount} claim${openFlagCount === 1 ? "" : "s"} still to be looked at before this can be approved.`;
}

/**
 * What was RECORDED, never what was achieved (§8.8). "Recorded" is the honest
 * verb: nothing in the section has been established as influence, and the
 * subheading under it says so.
 */
function influenceHeading(count: number): string {
  return `${count} influence record${count === 1 ? " was" : "s were"} added`;
}

/** The inbox preview line — what the morning holds, not the subject again. */
function previewLine(
  signalCount: number,
  briefs: DigestBriefView[] | null,
  classificationQueueCount: number | null,
  influence: DigestInfluenceView[] | null,
): string {
  const parts: string[] = [
    signalCount === 0
      ? "No new signals"
      : `${signalCount} new signal${signalCount === 1 ? "" : "s"}`,
  ];

  if (briefs !== null && briefs.length > 0) {
    parts.push(
      `${briefs.length} brief${briefs.length === 1 ? "" : "s"} awaiting a decision`,
    );
  }

  if (influence !== null && influence.length > 0) {
    parts.push(
      `${influence.length} influence record${influence.length === 1 ? "" : "s"}`,
    );
  }

  if (classificationQueueCount !== null && classificationQueueCount > 0) {
    parts.push(`${classificationQueueCount} awaiting classification`);
  }

  return `${parts.join(" · ")}.`;
}

/**
 * Preview data for `npm run email`. Fictional throughout, and deliberately
 * carries no evidence of any kind — the same rule the real props obey.
 */
MorningDigest.PreviewProps = {
  recipientName: "Ama",
  windowLabel: "the 24 hours to 06:30 UTC on 2 August 2026",
  appUrl: "http://localhost:3000",
  signalCount: 3,
  signalsTruncated: false,
  radar: { sourcesChecked: 5, sourcesFailed: 1 },
  signalGroups: [
    {
      urgency: "immediate",
      label: "Immediate",
      window: "under 4 weeks",
      signals: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          title:
            "Forestry Commission opens consultation on revised timber legality standards",
          summaryText:
            "A four-week consultation window on revisions to the legality assurance standard, with written submissions invited from civil society and industry.",
          sourceName: "Forestry Commission",
          detectedAt: "1 Aug 2026",
          relevanceLabel: "Core",
        },
      ],
    },
    {
      urgency: "near_term",
      label: "Near-term",
      window: "1–3 months",
      signals: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          title: "EU publishes draft guidance on EUDR smallholder due diligence",
          summaryText:
            "Draft guidance setting out how operators are expected to evidence smallholder plot geolocation, with a comment period closing in October.",
          sourceName: "EUDR implementing acts",
          detectedAt: "31 Jul 2026",
          relevanceLabel: "Core",
        },
      ],
    },
    {
      urgency: "watch",
      label: "Watch",
      window: "over 6 months",
      signals: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          title: "ITTO newsletter flags trade-legality discussions for 2027",
          summaryText:
            "A short notice of forthcoming discussions on legality frameworks in producer countries, with no dates fixed.",
          sourceName: "ITTO newsletters",
          detectedAt: "29 Jul 2026",
          relevanceLabel: "Background",
        },
      ],
    },
  ],
  briefs: [
    {
      id: "44444444-4444-4444-4444-444444444444",
      title: "Tree tenure reform and cocoa agroforestry uptake",
      briefTypeLabel: "Policy brief",
      audienceLabel: "Ghana ministry official",
      statusLabel: "Draft",
      openFlagCount: 2,
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      title: "Smallholder geolocation readiness in Juabeso-Bia",
      briefTypeLabel: "Technical submission",
      audienceLabel: "EU regulator / DG ENV",
      statusLabel: "Reviewed",
      openFlagCount: 0,
    },
  ],
  briefsTruncated: false,
  classificationQueueCount: 7,
  influence: [
    {
      id: "66666666-6666-6666-6666-666666666666",
      briefId: "44444444-4444-4444-4444-444444444444",
      briefTitle: "Tree tenure reform and cocoa agroforestry uptake",
      eventTypeLabel: "Cited in a policy document",
      detectionMethodLabel: "Found by the weekly search",
      verified: false,
    },
    {
      id: "77777777-7777-7777-7777-777777777777",
      briefId: "55555555-5555-5555-5555-555555555555",
      briefTitle: "Smallholder geolocation readiness in Juabeso-Bia",
      eventTypeLabel: "Dialogue outcome",
      detectionMethodLabel: "Logged by a person",
      verified: true,
    },
  ],
  influenceTruncated: false,
} satisfies MorningDigestProps;

export { MorningDigest };
