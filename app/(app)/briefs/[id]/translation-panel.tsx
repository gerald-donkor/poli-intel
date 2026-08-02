"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { classificationLabel } from "@/components/classification-badge";
import { GuardFlagIcon } from "@/components/guard-flag-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionRefusal } from "@/lib/auth/authorize";
import type { KeyMessage } from "@/lib/briefs/key-messages";
import { TRANSLATION_LANGUAGE } from "@/lib/briefs/translation-limits";
import type { BriefTranslationView } from "@/lib/db";

import { formatDecisionAt } from "../labels";
import { translateKeyMessagesAction } from "./actions";

/**
 * The translation assist — this brief's key messages in Twi, on demand.
 *
 * IT IS AN ASSIST, AND THE PRODUCT VERIFIED NOTHING (§8.8). The copy never says
 * "translated and verified", never "official", and never "send". A Twi speaker
 * checks this before it goes anywhere near a community.
 *
 * IT DOES NOT RUN ON ARRIVAL. A translation is a free-tier Gemini request, so it
 * happens because a person pressed a button (`brief-output` rule 6: on demand,
 * not pre-computed).
 *
 * A TRANSLATION BELONGS TO A VERSION. If the newest one renders an older
 * version, this panel says the brief has changed and offers a fresh run — it
 * NEVER shows that version's Twi beside the current English, which would put a
 * community in front of something the brief no longer says.
 *
 * BOTH LANGUAGES ARE INTER. The serif is reserved for quoted source material and
 * that distinction is load-bearing (§11.6); this is the product's own generated
 * prose in both columns. No italics, no second typeface, no red anywhere.
 *
 * PRESENTATION ONLY. Whether this person may translate is re-answered inside the
 * action, which also re-reads the evidence set and puts it through the
 * classification gate (§10.1, §7.2).
 */

const FADE_SECONDS = 0.22;

type Run =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "halted"; refusal: ActionRefusal };

export function TranslationPanel({
  briefId,
  currentVersion,
  statusLabel,
  messages,
  omitted,
  translation,
  openFlagCount,
  canTranslate,
  unavailableReason,
}: {
  briefId: string;
  currentVersion: number;
  statusLabel: string;
  /** The current version's key messages, extracted server-side. */
  messages: KeyMessage[];
  /** Key messages beyond the cap — named, never silently dropped. */
  omitted: number;
  /** The newest translation on this brief, whichever version it renders. */
  translation: BriefTranslationView | null;
  openFlagCount: number;
  /** Presentation only. The action authorises its own caller (§10.1). */
  canTranslate: boolean;
  /** Why not, in a sentence, when `canTranslate` is false. */
  unavailableReason: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [run, setRun] = useState<Run>({ phase: "idle" });
  const [saved, setSaved] = useState<BriefTranslationView | null>(null);

  const current = saved ?? translation;
  const isCurrent = current !== null && current.versionNumber === currentVersion;

  const running = run.phase === "running";

  const translate = async () => {
    setRun({ phase: "running" });

    const result = await translateKeyMessagesAction(briefId);

    if (!result.ok) {
      setRun({ phase: "halted", refusal: result.refusal });
      return;
    }

    setSaved(result.translation);
    setRun({ phase: "idle" });
    router.refresh();
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: FADE_SECONDS, ease: [0.2, 0, 0, 1] as const };

  return (
    <section
      aria-labelledby="translation-panel-heading"
      className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="translation-panel-heading"
          className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase"
        >
          {TRANSLATION_LANGUAGE} key messages
        </h2>
        <p className="text-ink-3 text-[12.5px] leading-[1.55]">
          The executive summary and each recommendation, rendered in{" "}
          {TRANSLATION_LANGUAGE} for a community conversation. Not the whole
          brief.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="text-ink-3 text-[12.5px] leading-[1.55]">
          This brief has no executive summary or recommendations to translate, so
          there is nothing to render.
        </p>
      ) : (
        <>
          {isCurrent && current !== null ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              className="flex min-w-0 flex-col gap-3"
            >
              <p className="text-ink-3 font-mono text-[11.5px] break-words">
                version {current.versionNumber} · {statusLabel.toLowerCase()} ·{" "}
                {current.generatingModel} · {current.promptVersion}
              </p>
              <p className="text-ink-3 font-mono text-[11.5px] break-words">
                Run by {current.translatedByName ?? "a member of staff"} on{" "}
                {formatDecisionAt(current.translatedAt)}
              </p>

              <ul className="flex min-w-0 flex-col gap-3">
                {current.messages.map((message, index) => (
                  <li
                    key={`${message.heading}-${index}`}
                    className="border-line flex min-w-0 flex-col gap-1.5 border-t pt-3 first:border-t-0 first:pt-0"
                  >
                    <h3 className="text-ink-3 text-meta font-semibold tracking-[0.06em] uppercase break-words">
                      {message.heading}
                    </h3>
                    {/* English first as the reference, Twi below as the thing
                        being read. Stacked at every width — the rail is 380px at
                        `desktop`, so a two-column split would be unreadable. */}
                    <p
                      lang="en"
                      className="text-ink-3 text-[12.5px] leading-[1.55] break-words"
                    >
                      {message.english}
                    </p>
                    <p
                      lang="tw"
                      className="text-ink-2 text-[13px] leading-[1.6] break-words"
                    >
                      {message.twi}
                    </p>
                  </li>
                ))}
              </ul>

              <CheckNotice />
            </motion.div>
          ) : null}

          {current !== null && !isCurrent ? (
            <StaleNotice
              translatedVersion={current.versionNumber}
              currentVersion={currentVersion}
            />
          ) : null}

          {current === null ? (
            <p className="text-ink-3 text-[12.5px] leading-[1.55]">
              Not translated yet. Running the assist renders{" "}
              {messages.length === 1
                ? "this one key message"
                : `these ${messages.length} key messages`}{" "}
              into {TRANSLATION_LANGUAGE} and keeps the result against version{" "}
              <span className="font-mono">{currentVersion}</span>.
            </p>
          ) : null}

          {omitted > 0 ? (
            <p className="text-ink-3 text-[12.5px] leading-[1.55]">
              This brief has {omitted} more key{" "}
              {omitted === 1 ? "message" : "messages"} than one run covers. Only
              the first {messages.length} are translated.
            </p>
          ) : null}

          {openFlagCount > 0 ? (
            <FlagNotice count={openFlagCount} />
          ) : null}

          {run.phase === "halted" ? (
            <RefusalPanel refusal={run.refusal} />
          ) : null}

          {canTranslate ? (
            <div className="flex flex-col items-start gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={running}
                onClick={() => void translate()}
                className="h-11 justify-center tablet:h-8"
              >
                {running
                  ? "Translating key messages…"
                  : isCurrent
                    ? "Translate again"
                    : "Translate the key messages"}
              </Button>
              {running ? (
                <p role="status" className="text-ink-3 text-[12.5px]">
                  Translating key messages…
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-ink-3 text-[12.5px] leading-[1.55]">
              {unavailableReason}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The standing caveat. Watch ramp, because it is a review prompt rather than an
 * error — and deliberately NOT the guard's circle glyph, which means a
 * hallucination flag and nothing else (`design-system`, shape rules).
 */
function CheckNotice() {
  return (
    <p className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[12.5px] leading-[1.55]">
      A translation assist. A {TRANSLATION_LANGUAGE} speaker checks this before
      it is used with a community.
    </p>
  );
}

/**
 * The brief has moved on since it was translated.
 *
 * The old Twi is deliberately NOT rendered beside the new English — that is the
 * worst outcome this feature can produce, and it is why a translation hangs off
 * a version rather than off the brief.
 */
function StaleNotice({
  translatedVersion,
  currentVersion,
}: {
  translatedVersion: number;
  currentVersion: number;
}) {
  return (
    <p className="bg-watch-surface border-watch-border text-watch-ink rounded-card border px-3 py-2 text-[12.5px] leading-[1.55]">
      This brief was translated at version{" "}
      <span className="font-mono">{translatedVersion}</span> and has changed
      since — it is now at version{" "}
      <span className="font-mono">{currentVersion}</span>. The earlier{" "}
      {TRANSLATION_LANGUAGE} text is not shown, because it renders wording this
      brief no longer uses. Run the assist again for the current version.
    </p>
  );
}

/**
 * The open-flag notice rides along, exactly as the Word export's does (§16.8).
 * It does not block: an unresolved flag blocks Programme Director approval and
 * nothing else (§9.5).
 */
function FlagNotice({ count }: { count: number }) {
  return (
    <Alert variant="guard" className="rounded-card">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <GuardFlagIcon className="size-3.5" />
        {count === 1
          ? "One claim in this brief is still being checked"
          : `${count} claims in this brief are still being checked`}
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>
          {count === 1 ? "It is" : "They are"} not traceable to the evidence
          supplied, so {count === 1 ? "it may" : "they may"} appear in the{" "}
          {TRANSLATION_LANGUAGE} text too.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Every refusal this action can return, given a designed state (§17.6). Watch or
 * immediate ramp throughout — never `destructive`, never red, never a toast.
 */
function RefusalPanel({ refusal }: { refusal: ActionRefusal }) {
  if (refusal.kind === "refused-ineligible-classification") {
    return (
      <Alert variant="pending" className="rounded-card">
        <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            aria-hidden="true"
            className="border-immediate size-3.5 shrink-0 rounded-[2px] border-2"
          />
          Translation refused — evidence is not eligible
        </AlertTitle>
        <AlertDescription className="text-immediate-ink/90 text-[13px]">
          <p>
            Nothing was sent to the model and nothing was saved. A brief cannot
            be re-sent to a model when the evidence behind it is no longer
            eligible, even though only the brief&rsquo;s own wording travels:
          </p>
          <ul className="mt-2 mb-3 flex list-disc flex-col gap-1 pl-5">
            {refusal.items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span> —{" "}
                {classificationLabel(item.classification).toLowerCase()}
              </li>
            ))}
          </ul>
          <p>
            <Link href="/evidence/queue" className="font-medium">
              Open the classification queue
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (refusal.kind === "rate-limited") {
    return (
      <Alert variant="guard" className="rounded-card">
        <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <GuardFlagIcon className="size-3.5" />
          Paused — the free-tier allowance is spent for the moment
        </AlertTitle>
        <AlertDescription className="text-watch-ink/90 text-[13px]">
          <p>
            Try again in about {formatRetry(refusal.retryAfterMs)}. Nothing was
            lost — the brief is untouched and no translation was saved.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const message =
    refusal.kind === "unauthorised" || refusal.kind === "generation-failed"
      ? refusal.message
      : refusal.kind === "invalid"
        ? (Object.values(refusal.fieldErrors)[0]?.[0] ??
          "That request could not be read.")
        : "Nothing was saved.";

  return (
    <Alert variant="guard" className="rounded-card">
      <AlertTitle className="flex items-center gap-2 text-[13px] font-semibold">
        <GuardFlagIcon className="size-3.5" />
        {refusal.kind === "unauthorised"
          ? "Not permitted"
          : "Nothing was translated"}
      </AlertTitle>
      <AlertDescription className="text-watch-ink/90 text-[13px]">
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}

function formatRetry(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);

  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
