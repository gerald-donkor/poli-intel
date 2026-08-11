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

import type {
  RadarGapReport,
  RadarGapSourceRow,
  RadarGapStatus,
} from "@/lib/radar/gap-analysis-core";

export type RadarGapAnalysisEmailProps = {
  recipientName: string;
  appUrl: string;
  report: RadarGapReport;
};

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
  watch: "#496375",
  "watch-ink": "#33495a",
  "watch-surface": "#e7edf2",
  "watch-border": "#c6d4df",
};

const theme = {
  presets: [pixelBasedPreset],
  theme: { extend: { colors: palette } },
};

const RULE_STYLE = { borderTop: `1px solid ${palette.line}` };

const STATUS_VIEW: Record<
  RadarGapStatus,
  {
    label: string;
    mark: string;
    row: string;
    markClass: string;
    textClass: string;
    sentence: string;
  }
> = {
  signals_found: {
    label: "Signals found",
    mark: "●",
    row: "border-primary bg-card",
    markClass: "text-primary",
    textClass: "text-primary-ink",
    sentence: "This source produced new signal rows during the week.",
  },
  quiet: {
    label: "Checked, no new rows",
    mark: "□",
    row: "border-surface-tint-border bg-surface-tint",
    markClass: "text-primary-ink",
    textClass: "text-primary-ink",
    sentence: "This source was checked and produced no new signal rows.",
  },
  failed: {
    label: "Latest check failed",
    mark: "◇",
    row: "border-watch-border bg-watch-surface",
    markClass: "text-watch",
    textClass: "text-watch-ink",
    sentence: "The latest check did not complete.",
  },
  not_checked: {
    label: "No check recorded",
    mark: "■",
    row: "border-watch-border bg-card",
    markClass: "text-watch",
    textClass: "text-watch-ink",
    sentence: "No run was recorded for this source in the window.",
  },
  not_implemented: {
    label: "Not yet monitored",
    mark: "□",
    row: "border-line bg-stone",
    markClass: "text-ink-3",
    textClass: "text-ink-2",
    sentence: "The declared retrieval path is not yet implemented.",
  },
};

export default function RadarGapAnalysisEmail({
  recipientName,
  appUrl,
  report,
}: RadarGapAnalysisEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind config={theme}>
        <Head />
        <Body className="bg-paper font-sans text-ink m-0 p-0">
          <Preview>{previewText(report)}</Preview>
          <Container
            lang="en"
            dir="ltr"
            className="mx-auto w-full max-w-[600px] p-[16px]"
          >
            <Section className="mb-[16px]">
              <Text className="text-ink-3 m-0 text-[12px] uppercase tracking-[0.06em]">
                EviBrief · Policy Radar
              </Text>
              <Heading
                as="h1"
                className="text-ink m-0 mt-[4px] text-[22px] leading-[1.3] font-semibold"
              >
                Weekly radar gap analysis
              </Heading>
              <Text className="text-ink-3 m-0 mt-[6px] text-[13px] leading-[1.5]">
                {recipientName}, this covers {windowLabel(report)}.
              </Text>
            </Section>

            <Hr style={RULE_STYLE} className="m-0 mb-[16px] border-0" />

            <Section className="bg-card border-line mb-[16px] rounded-[6px] border border-solid p-[14px]">
              <Heading
                as="h2"
                className="text-ink m-0 text-[16px] leading-[1.4] font-semibold"
              >
                Source-health summary
              </Heading>
              <Text className="text-ink-2 m-0 mt-[8px] text-[14px] leading-[1.6]">
                {report.totals.runs} runs were recorded across{" "}
                {report.totals.sources} monitored sources.{" "}
                {report.totals.signalsCreated} signal rows were created and{" "}
                {report.totals.duplicatesSuppressed} repeats were suppressed.
              </Text>
              <Text className="text-ink-3 m-0 mt-[8px] text-[12px] leading-[1.5]">
                {report.totals.signalsFound} with new rows ·{" "}
                {report.totals.quiet} checked with no new rows ·{" "}
                {report.totals.failed} latest checks failed ·{" "}
                {report.totals.notChecked} not checked ·{" "}
                {report.totals.notImplemented} not yet monitored
              </Text>
              <Text className="m-0 mt-[10px] text-[14px] leading-[1.5]">
                <Link
                  href={`${appUrl}/signals`}
                  className="text-primary-ink no-underline"
                >
                  Review the signal board
                </Link>
              </Text>
            </Section>

            {report.sources.map((source) => (
              <SourceRow key={source.sourceId} source={source} />
            ))}

            <Hr style={RULE_STYLE} className="m-[0] mt-[8px] border-0" />

            <Text className="text-ink-3 m-0 mt-[12px] text-[12px] leading-[1.5]">
              This report uses source registry metadata and radar run counts
              only.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function SourceRow({ source }: { source: RadarGapSourceRow }) {
  const view = STATUS_VIEW[source.status];

  return (
    <Section
      className={`mb-[10px] rounded-[6px] border border-solid p-[12px] ${view.row}`}
    >
      <Text className="m-0 text-[13px] leading-[1.4]">
        <span className={`${view.markClass} text-[14px]`}>{view.mark}</span>{" "}
        <span className={`${view.textClass} font-semibold`}>{view.label}</span>
      </Text>
      <Heading
        as="h2"
        className="text-ink m-0 mt-[6px] text-[15px] leading-[1.4] font-semibold"
      >
        {source.sourceName}
      </Heading>
      <Text className="text-ink-2 m-0 mt-[6px] text-[13px] leading-[1.55]">
        {view.sentence}
      </Text>
      <Text className="text-ink-3 m-0 mt-[8px] text-[12px] leading-[1.5]">
        {source.retrievalMethod} · {source.cadenceLabel} · {source.signalTypes}
      </Text>
      <Text className="text-ink-3 m-0 mt-[8px] text-[12px] leading-[1.5]">
        Runs {source.totals.runs} · Items seen {source.totals.itemsSeen} · New
        rows {source.totals.signalsCreated} · Repeats suppressed{" "}
        {source.totals.duplicatesSuppressed}
      </Text>
      {source.latestRun ? (
        <Text className="text-ink-3 m-0 mt-[6px] text-[12px] leading-[1.5]">
          Latest: {source.latestRun.outcome} at{" "}
          {formatTimestamp(source.latestRun.startedAt)}
          {source.latestRun.failureReason
            ? ` · ${source.latestRun.failureReason}`
            : ""}
        </Text>
      ) : null}
    </Section>
  );
}

function previewText(report: RadarGapReport): string {
  return `${report.totals.sources} radar sources: ${report.totals.failed} failed, ${report.totals.notChecked} not checked, ${report.totals.signalsCreated} new signal rows.`;
}

function windowLabel(report: RadarGapReport): string {
  return `${formatDate(report.windowStart)} to ${formatDate(report.windowEnd)} UTC`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

RadarGapAnalysisEmail.PreviewProps = {
  recipientName: "Ama Owusu",
  appUrl: "https://evibrief.example.org",
  report: {
    weekKey: "2026-08-10",
    windowStart: "2026-08-03T07:00:00.000Z",
    windowEnd: "2026-08-10T07:00:00.000Z",
    totals: {
      sources: 4,
      notChecked: 1,
      failed: 1,
      notImplemented: 0,
      quiet: 1,
      signalsFound: 1,
      runs: 7,
      itemsSeen: 28,
      signalsCreated: 3,
      duplicatesSuppressed: 5,
    },
    sources: [
      {
        sourceId: "ghana-gazette",
        sourceName: "Ghana Gazette / Forestry Commission",
        cadenceLabel: "daily",
        retrievalMethod: "rss",
        signalTypes: "Draft regulations, policy notices",
        status: "signals_found",
        latestRun: {
          outcome: "found",
          startedAt: "2026-08-10T05:02:00.000Z",
          finishedAt: "2026-08-10T05:03:00.000Z",
          failureReason: null,
        },
        totals: {
          runs: 5,
          found: 2,
          empty: 3,
          failed: 0,
          notImplemented: 0,
          itemsSeen: 18,
          signalsCreated: 3,
          duplicatesSuppressed: 4,
        },
      },
      {
        sourceId: "cocobod",
        sourceName: "Cocobod announcements",
        cadenceLabel: "weekly",
        retrievalMethod: "scrape",
        signalTypes: "Standard revisions, trade requirements",
        status: "quiet",
        latestRun: {
          outcome: "empty",
          startedAt: "2026-08-04T05:10:00.000Z",
          finishedAt: "2026-08-04T05:11:00.000Z",
          failureReason: null,
        },
        totals: {
          runs: 1,
          found: 0,
          empty: 1,
          failed: 0,
          notImplemented: 0,
          itemsSeen: 10,
          signalsCreated: 0,
          duplicatesSuppressed: 1,
        },
      },
      {
        sourceId: "unfccc",
        sourceName: "UNFCCC secretariat",
        cadenceLabel: "weekly",
        retrievalMethod: "scrape",
        signalTypes: "Draft decisions, negotiating texts",
        status: "failed",
        latestRun: {
          outcome: "failed",
          startedAt: "2026-08-04T05:20:00.000Z",
          finishedAt: "2026-08-04T05:20:20.000Z",
          failureReason: "scrape:no_items",
        },
        totals: {
          runs: 1,
          found: 0,
          empty: 0,
          failed: 1,
          notImplemented: 0,
          itemsSeen: 0,
          signalsCreated: 0,
          duplicatesSuppressed: 0,
        },
      },
      {
        sourceId: "itto",
        sourceName: "ITTO newsletters",
        cadenceLabel: "monthly",
        retrievalMethod: "scrape",
        signalTypes: "Trade policy, legality discussions",
        status: "not_checked",
        latestRun: null,
        totals: {
          runs: 0,
          found: 0,
          empty: 0,
          failed: 0,
          notImplemented: 0,
          itemsSeen: 0,
          signalsCreated: 0,
          duplicatesSuppressed: 0,
        },
      },
    ],
  },
} satisfies RadarGapAnalysisEmailProps;

export { RadarGapAnalysisEmail };
