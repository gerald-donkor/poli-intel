import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";

import {
  EMBEDDING_DEFAULT_RETRY_AFTER_MS,
  EMBEDDING_MAX_RETRY_AFTER_MS,
} from "./config";

/**
 * Shared Gemini plumbing: the client, and how a failed request is read.
 *
 * This module exists because there are now two call paths into the embedding
 * API — evidence chunks (`embeddings.ts`) and staff-typed search queries
 * (`query-embedding.ts`) — and a backoff rule that exists twice is a backoff
 * rule that drifts. One copy, both callers.
 *
 * NOTHING HERE IS A DOOR INTO THE MODEL. It hands back a client and reads an
 * error; it never accepts text, so it cannot be the path evidence takes past the
 * gate. The gate sits at each call path's own entry point (AGENTS.md §7.2).
 *
 * LOGGING: nothing here logs a caught error's message. An API error body can
 * echo the request material back, and the machine reason plus the HTTP status
 * debug the pipeline without exporting anything (§7.6, §13.9).
 */

/** Lazy so a missing key is a typed refusal at call time, not an import crash. */
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Server-only, and never `NEXT_PUBLIC_*` (AGENTS.md §18). Absent is an
  // ordinary, reportable outcome — not an obscure SDK error three frames down.
  if (!apiKey) return null;

  client ??= new GoogleGenAI({ apiKey });

  return client;
}

/**
 * The two ways a Gemini request fails that every call path must handle. Both
 * callers widen this into their own failure union; neither redefines it.
 */
export type GeminiRequestFailure =
  | { reason: "rate_limited"; retryAfterMs: number }
  | { reason: "request_failed"; status: number | null };

export function toGeminiRequestFailure(error: unknown): GeminiRequestFailure {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return {
        reason: "rate_limited",
        retryAfterMs: readRetryDelayMs(error.message),
      };
    }

    return { reason: "request_failed", status: error.status };
  }

  return { reason: "request_failed", status: null };
}

/**
 * Gemini returns a `retryDelay` in a 429's error details. The SDK surfaces the
 * body only as the error message, so it is read out with a bounded pattern and
 * clamped — the hint is honoured where it exists (`gemini-integration`) without
 * letting a malformed one park a run.
 *
 * The message itself is never logged or stored; only the number leaves here.
 */
export function readRetryDelayMs(message: string): number {
  const match = /"retryDelay"\s*:\s*"(\d{1,5})(?:\.\d+)?s"/.exec(message);

  if (!match) return EMBEDDING_DEFAULT_RETRY_AFTER_MS;

  const seconds = Number(match[1]);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return EMBEDDING_DEFAULT_RETRY_AFTER_MS;
  }

  return Math.min(seconds * 1000, EMBEDDING_MAX_RETRY_AFTER_MS);
}
