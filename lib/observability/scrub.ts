/**
 * Redaction for anything leaving the box as telemetry.
 *
 * WHY THIS IS A LAYER AND NOT A CONVENTION. `AGENTS.md` §7.6 and §13.9 forbid
 * evidence body text reaching third-party storage, and Sentry is third-party
 * storage. The project already logs safely by hand — every `console.warn` in
 * `lib/` and `app/` passes ids, counts, and statuses and nothing else — but an
 * error reporter is not a call site anyone writes. It collects an exception's
 * message, its stack, the console history, and the request that produced it,
 * none of which the author of a `throw` was thinking about. So redaction sits
 * on the transport, in `beforeSend` / `beforeSendTransaction` /
 * `beforeBreadcrumb`, and there is no exported init that omits it. Same
 * reasoning as the classification gate: no unscrubbed door.
 *
 * ALLOWLIST, NEVER DENYLIST. A denylist of key names — "text", "body",
 * "content" — dies the day someone adds `excerpt`, `chunk`, or `passage`. This
 * module keeps a value only when its *shape* matches what this project actually
 * logs: ids, enum tokens, numbers, booleans, timestamps, short technical
 * strings. Prose does not have that shape, so prose does not survive, whatever
 * the key is called and whoever added it.
 *
 * IT DOES NOT READ CLASSIFICATION, AND MUST NOT. Redacting by shape protects
 * `public_published`, `community_sourced`, and `unpublished_internal` items
 * identically, and cannot be defeated by an item that is mis-tagged or not yet
 * tagged at all. A scrubber that trusted a classification field would inherit
 * every mistake the classification queue can make.
 *
 * REDACTED IS NOT DROPPED. A blocked value is replaced in place with a marker
 * naming its type and length. The event still goes. A redacted event is more
 * useful than no event, and it cannot be mistaken for a silent drop —
 * `evidence-governance` is explicit that ids, classifications, counts, and
 * timings are enough to debug the pipeline, and those are exactly what survives.
 *
 * PURE, AND DELIBERATELY NOT `server-only`, for the same reason `lib/net/secret.ts`
 * is not: there is no secret and no environment here. That is what makes it
 * testable with `npx tsx` and no running app, and it is why the exports are
 * plain functions over structural types rather than Sentry's — the same
 * scrubber has to serve PostHog later without dragging `@sentry/nextjs` into a
 * browser bundle that does not want it.
 *
 * THERE IS NO BYPASS. No env var, no `force`, no "development only" branch.
 * A dev bypass is a production bypass with a different name.
 */

/* -------------------------------------------------------------------------- */
/* The ceilings                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Longest string kept verbatim, in characters.
 *
 * 64 because the things worth keeping are all comfortably under it: a cuid2 is
 * ~24, a UUID is 36, `unpublished_internal` is 20, an ISO timestamp is 24, and
 * `radar.source.scrape_failed` is 26. A policy excerpt is not. The ceiling is
 * the crude half of the rule; `WORD_MAX` below is the half that catches a short
 * sentence.
 */
const STRING_MAX = 64;

/**
 * Most whitespace-separated words a retained string may have.
 *
 * Four, because identifiers have one and the SDK's own context values have two
 * or three — "Linux 7.1.5-arch1-2", "node v22.11.0", "chrome 141.0.0". Human
 * sentences have more. This is what stops a 60-character fragment of a farmer's
 * observation from riding out under the length ceiling.
 */
const WORD_MAX = 4;

/** Longest error/breadcrumb message kept at all. See `scrubMessage`. */
const MESSAGE_MAX = 200;

/** Most words a retained message may have. Developer messages are terse. */
const MESSAGE_WORD_MAX = 12;

/** Longest URL kept after its query string is removed. */
const URL_MAX = 200;

/** How deep to walk a context object before giving up and redacting. */
const DEPTH_MAX = 5;

/** How many array elements to walk before summarising the tail. */
const ARRAY_MAX = 50;

/* -------------------------------------------------------------------------- */
/* Structural types — deliberately not Sentry's                               */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

/** The subset of an event payload this module knows how to walk. */
export type ScrubbableEvent = {
  message?: unknown;
  logentry?: unknown;
  transaction?: unknown;
  exception?: unknown;
  breadcrumbs?: unknown;
  request?: unknown;
  extra?: unknown;
  contexts?: unknown;
  tags?: unknown;
  user?: unknown;
  spans?: unknown;
  [key: string]: unknown;
};

/** The subset of a breadcrumb this module knows how to walk. */
export type ScrubbableBreadcrumb = {
  message?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wordCount(value: string): number {
  const trimmed = value.trim();

  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/* -------------------------------------------------------------------------- */
/* Strings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A URL keeps its origin and path and loses everything after them.
 *
 * The query string is the point: an Evidence Library search is `?q=<the thing
 * someone typed>`, and what someone types into an evidence search is evidence
 * text by another name. The fragment goes for the same reason. A malformed URL
 * is not repaired — it falls through to the ordinary string rule.
 */
function scrubUrl(value: string): string {
  try {
    const url = new URL(value);
    const bare = `${url.origin}${url.pathname}`;

    return bare.length <= URL_MAX ? bare : `[redacted url · ${value.length} chars]`;
  } catch {
    return scrubPlainString(value);
  }
}

function scrubPlainString(value: string): string {
  if (value.includes("\n")) return `[redacted string · ${value.length} chars]`;
  if (value.length > STRING_MAX) return `[redacted string · ${value.length} chars]`;
  if (wordCount(value) > WORD_MAX) return `[redacted string · ${value.length} chars]`;

  return value;
}

function scrubString(value: string): string {
  if (/^https?:\/\//i.test(value)) return scrubUrl(value);

  return scrubPlainString(value);
}

/**
 * Messages get their own, looser rule, because a message is the one field whose
 * *purpose* is a sentence — "Pandoc exited with status 127" has to survive or
 * Sentry reports nothing worth reading.
 *
 * THE REALISTIC LEAK IS INTERPOLATION: `throw new Error(\`no match for
 * "${chunk.text}"\`)`. A key-based filter never sees it, because it is not in a
 * key. Three rules in order handle it:
 *
 *   1. A long or multi-line or many-worded message is prose, not a developer
 *      string, and goes entirely. This is what makes a 2,000-character block
 *      pasted into a message disappear rather than survive as a truncated head.
 *   2. Quoted spans go, because interpolated values are nearly always quoted.
 *   3. Any remaining over-long token goes, because the un-quoted interpolation
 *      of an id-shaped-but-huge value is the leftover case.
 *
 * What remains is a bounded residual: an un-quoted interpolation shorter than
 * MESSAGE_MAX and under twelve words could survive. That is deliberate — the
 * alternative is dropping messages wholesale and reporting exceptions with no
 * description at all. The bound is stated here so it is a known limit rather
 * than an assumption.
 */
function scrubMessage(value: string): string {
  if (value.includes("\n")) return `[redacted message · ${value.length} chars]`;
  if (value.length > MESSAGE_MAX) return `[redacted message · ${value.length} chars]`;
  if (wordCount(value) > MESSAGE_WORD_MAX) {
    return `[redacted message · ${value.length} chars]`;
  }

  const withoutQuoted = value.replace(
    /(["'`])(?:\\.|(?!\1)[\s\S])*\1/g,
    "'[redacted]'",
  );

  return withoutQuoted
    .split(/(\s+)/)
    .map((token) =>
      token.length > STRING_MAX ? `[redacted token · ${token.length} chars]` : token,
    )
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Values                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The general walk. Scalars are kept when their shape says they are metadata;
 * everything else is replaced with a marker naming its type and size.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;

  if (type === "boolean") return value;
  if (type === "number") {
    return Number.isFinite(value) ? value : "[redacted number · not finite]";
  }
  if (type === "bigint") return `${String(value)}n`;
  if (type === "string") return scrubString(value as string);
  if (type === "function" || type === "symbol") return `[redacted ${type}]`;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "[redacted date]" : value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= DEPTH_MAX) return `[redacted array · ${value.length} items]`;

    const kept = value
      .slice(0, ARRAY_MAX)
      .map((entry) => scrubValue(entry, depth + 1));

    return value.length > ARRAY_MAX
      ? [...kept, `[redacted array tail · ${value.length - ARRAY_MAX} items]`]
      : kept;
  }

  if (isPlainObject(value)) {
    if (depth >= DEPTH_MAX) {
      return `[redacted object · ${Object.keys(value).length} keys]`;
    }

    return scrubObject(value, depth + 1);
  }

  // Errors, class instances, Maps, Sets — anything whose own enumeration rules
  // we have not reasoned about does not get walked.
  return `[redacted ${Object.prototype.toString.call(value).slice(8, -1).toLowerCase()}]`;
}

function scrubObject(value: Json, depth: number): Json {
  const out: Json = {};

  for (const [key, entry] of Object.entries(value)) {
    // Keys are written by developers, not derived from data, but a key long
    // enough to be prose is treated as prose.
    const safeKey = key.length > STRING_MAX ? `[redacted key · ${key.length} chars]` : key;

    out[safeKey] = scrubValue(entry, depth);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Stack frames                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Frames are an explicit key allowlist rather than a shape rule, because a file
 * path is long and slash-heavy and the shape rule would eat every one of them —
 * leaving a stack trace with no locations, which is the same as no stack trace.
 *
 * The keys below are all SDK-derived code locations. `vars` is the one that
 * matters by its absence: local variables at the throw site are exactly where a
 * chunk of evidence text lives, and no allowlist entry brings them back.
 */
const FRAME_KEYS = [
  "filename",
  "abs_path",
  "function",
  "module",
  "lineno",
  "colno",
  "in_app",
  "platform",
  "context_line",
  "pre_context",
  "post_context",
] as const;

function scrubFrame(frame: unknown): unknown {
  if (!isPlainObject(frame)) return scrubValue(frame);

  const out: Json = {};

  for (const key of FRAME_KEYS) {
    if (key in frame) out[key] = frame[key];
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Breadcrumbs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Console breadcrumbs are on by default in the browser SDK, so without this the
 * reporter would vacuum up whatever any component logged on the way to the
 * crash. `data` gets the ordinary value walk; the message gets the message rule.
 */
export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  const out: ScrubbableBreadcrumb = { ...(breadcrumb as ScrubbableBreadcrumb) };

  if (typeof out.message === "string") out.message = scrubMessage(out.message);
  if (out.data !== undefined) out.data = scrubValue(out.data);

  return out as T;
}

/* -------------------------------------------------------------------------- */
/* The event                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The single entry point. Every Sentry transport path in this app runs through
 * it — `beforeSend`, `beforeSendTransaction`, and (via `scrubBreadcrumb`)
 * `beforeBreadcrumb` in `lib/observability/sentry-options.ts`.
 *
 * Returns a shallow copy with the risky branches rewritten. The input is not
 * mutated.
 */
export function scrubEvent<T extends object>(event: T): T {
  const out: ScrubbableEvent = { ...(event as ScrubbableEvent) };

  if (typeof out.message === "string") out.message = scrubMessage(out.message);

  if (isPlainObject(out.logentry)) {
    const logentry: Json = { ...out.logentry };

    if (typeof logentry.message === "string") {
      logentry.message = scrubMessage(logentry.message);
    }
    // `params` are the interpolation arguments themselves — the raw values a
    // parameterised message was built from.
    delete logentry.params;
    out.logentry = logentry;
  }

  if (typeof out.transaction === "string") out.transaction = scrubString(out.transaction);

  out.exception = scrubException(out.exception);

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs.map((crumb) =>
      isPlainObject(crumb) ? scrubBreadcrumb(crumb) : scrubValue(crumb),
    );
  }

  out.request = scrubRequest(out.request);
  out.user = scrubUser(out.user);

  if (out.extra !== undefined) out.extra = scrubValue(out.extra);
  if (out.contexts !== undefined) out.contexts = scrubValue(out.contexts);
  if (out.tags !== undefined) out.tags = scrubValue(out.tags);

  // Transactions only, and `tracesSampleRate` is 0 today — but the hook is
  // wired, so the span branch is written rather than assumed unreachable.
  if (Array.isArray(out.spans)) {
    out.spans = out.spans.map((span) => {
      if (!isPlainObject(span)) return scrubValue(span);

      const next: Json = { ...span };

      if (typeof next.description === "string") {
        next.description = scrubString(next.description);
      }
      if (typeof next.name === "string") next.name = scrubString(next.name);
      if (next.data !== undefined) next.data = scrubValue(next.data);

      return next;
    });
  }

  return out as T;
}

function scrubException(exception: unknown): unknown {
  if (!isPlainObject(exception)) return exception;

  const out: Json = { ...exception };

  if (Array.isArray(out.values)) {
    out.values = out.values.map((entry) => {
      if (!isPlainObject(entry)) return scrubValue(entry);

      const next: Json = { ...entry };

      // The exception's own message — the `throw new Error(...)` string.
      if (typeof next.value === "string") next.value = scrubMessage(next.value);

      if (isPlainObject(next.stacktrace) && Array.isArray(next.stacktrace.frames)) {
        next.stacktrace = {
          ...next.stacktrace,
          frames: next.stacktrace.frames.map(scrubFrame),
        };
      }

      return next;
    });
  }

  return out;
}

/**
 * A request contributes almost nothing safe.
 *
 * `data` is a Server Action's serialised arguments — the evidence body someone
 * just submitted. `cookies` and `headers` carry the session token and the
 * `Authorization` header. `query_string` is the search someone typed. None of
 * them is worth a debugging round, and the shape rule alone would not stop a
 * short one, so they are removed outright rather than walked.
 */
function scrubRequest(request: unknown): unknown {
  if (!isPlainObject(request)) return request;

  const out: Json = { ...request };

  delete out.data;
  delete out.cookies;
  delete out.headers;
  delete out.query_string;
  delete out.env;

  if (typeof out.url === "string") out.url = scrubUrl(out.url);
  if (typeof out.method === "string") out.method = scrubString(out.method);

  return out;
}

/**
 * Staff are named individuals at a small organisation and the app is
 * Workspace-SSO-only, so `sendDefaultPii` is false and the scope carries the id
 * and role only (`AGENTS.md` §18). This strips the rest even if some future
 * integration attaches it.
 */
function scrubUser(user: unknown): unknown {
  if (!isPlainObject(user)) return user;

  const out: Json = { ...user };

  delete out.email;
  delete out.username;
  delete out.ip_address;
  delete out.name;

  return scrubValue(out) as Json;
}
