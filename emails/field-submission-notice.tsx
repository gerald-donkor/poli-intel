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

/**
 * A Field Officer has submitted an observation (AGENTS.md §17.3, §12.8).
 *
 * IT CARRIES NO OBSERVATION TEXT, EVER. The title the officer gave it, who sent
 * it, where and when they saw it, and a link. Not one word of the observation
 * body — a field submission is community-sourced material at
 * `unpublished_internal`, an email leaves Tropenbos-controlled infrastructure,
 * and §7.6 does not have an exception for "but the recipient is allowed to read
 * it". The Research Officer reads it in the app, behind auth.
 *
 * The title is the one thing the officer wrote that does travel, and it travels
 * because a notice that cannot say WHICH submission is a notice nobody acts on.
 * It is a label they chose, not the observation.
 *
 * IT LINKS, AND NEVER ACTS. No classify-from-email link, not behind a token: a
 * classification change is a Server Action that authorises its caller (§10.8).
 *
 * NO IMAGES, NO WEB FONTS, NO TRACKING PIXEL — low bandwidth is a stated
 * requirement, and there is no leaf or forest imagery to get wrong (§11.7).
 */

export type FieldSubmissionNoticeProps = {
  recipientName: string;
  /** The label the officer gave the update. Never the observation body. */
  submissionTitle: string;
  submitterName: string;
  /** The officer's own words for the place, where they gave one. */
  locationNote: string | null;
  /** When they saw it, where they said. Already formatted. */
  observedAtLabel: string | null;
  submittedAtLabel: string;
  /** How many items are now waiting to be classified, including this one. */
  pendingClassificationCount: number;
  appUrl: string;
};

/**
 * The palette, mirrored from the `@theme` block in `app/globals.css` — an email
 * cannot read a CSS custom property, and every client that matters strips
 * `:root`. Same copy, same reason, as `morning-digest.tsx`.
 *
 * The classification-pending ramp is the immediate (bronze) one, per the
 * handoff's governance-state table. Never red: nothing in this product is
 * (§11.4).
 */
const palette = {
  primary: "#0f6e56",
  "primary-ink": "#0b5644",
  "surface-tint": "#e1f5ee",
  paper: "#f7f5f0",
  card: "#fdfcf9",
  stone: "#efece4",
  line: "#e4e1d8",
  ink: "#2c2c2a",
  "ink-2": "#444441",
  "ink-3": "#6b6b66",
  immediate: "#8a6032",
  "immediate-ink": "#5e4020",
  "immediate-surface": "#f3ebe0",
  "immediate-border": "#e0d2be",
};

const theme = {
  presets: [pixelBasedPreset],
  theme: { extend: { colors: palette } },
};

/** See the note in `morning-digest.tsx` — `Hr` hard-codes its own border. */
const RULE_STYLE = { borderTop: `1px solid ${palette.line}` };

export default function FieldSubmissionNotice({
  recipientName,
  submissionTitle,
  submitterName,
  locationNote,
  observedAtLabel,
  submittedAtLabel,
  pendingClassificationCount,
  appUrl,
}: FieldSubmissionNoticeProps) {
  return (
    <Html lang="en">
      <Tailwind config={theme}>
        <Head />
        <Body className="bg-paper font-sans text-ink m-0 p-0">
          <Preview>
            {`${submitterName} sent a field update: ${submissionTitle}`}
          </Preview>

          <Container className="mx-auto w-full max-w-[600px] p-[16px]">
            <Section className="mb-[16px]">
              <Text className="text-ink-3 m-0 text-[12px] tracking-[0.06em] uppercase">
                EviBrief · Knowledge base
              </Text>
              <Heading
                as="h1"
                className="text-ink m-0 mt-[4px] text-[22px] leading-[1.3] font-semibold"
              >
                A new field update is waiting for review
              </Heading>
              <Text className="text-ink-3 m-0 mt-[6px] text-[13px] leading-[1.5]">
                {recipientName}, {submitterName} submitted this from the field on{" "}
                {submittedAtLabel}.
              </Text>
            </Section>

            <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

            {/*
              The card carries the label and the provenance. The body of the
              observation is deliberately not here and must not be added.
            */}
            <Section className="bg-card border-line mb-[16px] rounded-[6px] border border-solid p-[16px]">
              <Heading
                as="h2"
                className="text-ink m-0 text-[16px] leading-[1.4] font-semibold"
              >
                {submissionTitle}
              </Heading>
              <Text className="text-ink-3 m-0 mt-[6px] text-[12px] leading-[1.6]">
                {locationNote ? `Place: ${locationNote}` : "No place recorded"}
                {observedAtLabel ? ` · Seen on ${observedAtLabel}` : ""}
              </Text>
              <Text className="m-0 mt-[12px] text-[13px] leading-[1.5]">
                <Link
                  href={`${appUrl}/evidence/queue`}
                  className="text-primary underline"
                >
                  Read it and set its classification
                </Link>
              </Text>
            </Section>

            {/*
              The governance hold, said plainly. Square-adjacent bronze surface
              rather than the slate review-flag treatment — these are different
              states and are distinguished by more than colour (§11.7).
            */}
            <Section className="bg-immediate-surface border-immediate-border mb-[16px] rounded-[6px] border border-solid p-[12px]">
              <Text className="text-immediate-ink m-0 text-[13px] leading-[1.6]">
                This update is held out of the AI pipeline until someone
                classifies it. {pendingClassificationCount}{" "}
                {pendingClassificationCount === 1 ? "item is" : "items are"}{" "}
                waiting.
              </Text>
            </Section>

            <Hr style={RULE_STYLE} className="m-0 mb-[12px] border-0" />

            <Text className="text-ink-3 m-0 text-[12px] leading-[1.5]">
              The update itself is only readable in EviBrief, where you sign in.
              It is not included in this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

FieldSubmissionNotice.PreviewProps = {
  recipientName: "Kwabena",
  submissionTitle: "Cocoa farmers clearing shade trees near the reserve edge",
  submitterName: "Akosua Mensah",
  locationNote: "Eastern edge of Juabeso-Bia, near Kunkumso",
  observedAtLabel: "1 August 2026",
  submittedAtLabel: "3 August 2026",
  pendingClassificationCount: 4,
  appUrl: "http://localhost:3000",
} satisfies FieldSubmissionNoticeProps;
