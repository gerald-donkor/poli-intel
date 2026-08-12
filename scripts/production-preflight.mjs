#!/usr/bin/env node

import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const counts = {
  blockers: 0,
  warnings: 0,
  configured: 0,
};

const fakePatterns = [
  /(^|[-_:/@.])fake($|[-_:/@.])/i,
  /(^|[-_:/@.])dummy($|[-_:/@.])/i,
  /placeholder/i,
  /changeme/i,
  /example/i,
  /do-not-use/i,
  /evibrief_test/i,
  /localhost/i,
  /127\.0\.0\.1/,
];

function clean(key) {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function has(key) {
  return clean(key).length > 0;
}

function isFakeLooking(value) {
  return fakePatterns.some((pattern) => pattern.test(value));
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isDomainLike(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isBase64Bytes(value, bytes) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;

  try {
    return Buffer.from(value, "base64").length === bytes;
  } catch {
    return false;
  }
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function status(kind, variable, message) {
  if (kind === "blocker") counts.blockers += 1;
  if (kind === "warning") counts.warnings += 1;
  if (kind === "configured") counts.configured += 1;

  return { kind, variable, message };
}

function configured(variable, message = "present") {
  return status("configured", variable, message);
}

function warning(variable, message) {
  return status("warning", variable, message);
}

function blocker(variable, message) {
  return status("blocker", variable, message);
}

function missing(key, message = "required for production") {
  return blocker(key, `missing - ${message}`);
}

function checkRequiredPresence(key, message) {
  const value = clean(key);
  if (!value) return missing(key, message);
  if (isFakeLooking(value)) return blocker(key, "fake-looking - replace before production");
  return configured(key);
}

function checkConnectionUrl(key) {
  const value = clean(key);
  if (!value) return missing(key, "Supabase PostgreSQL connection is required");
  if (isFakeLooking(value)) {
    return blocker(key, "fake or local-looking database URL");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    return blocker(key, "invalid shape - expected PostgreSQL URL");
  }
  return configured(key, "PostgreSQL URL-shaped");
}

function section(title, rows) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));

  for (const row of rows) {
    const label =
      row.kind === "blocker"
        ? "BLOCKER"
        : row.kind === "warning"
          ? "WARN"
          : "OK";
    console.log(`${label.padEnd(7)} ${row.variable.padEnd(38)} ${row.message}`);
  }
}

function checkCoreAuth() {
  const rows = [];
  const authSecret = clean("AUTH_SECRET");

  if (!authSecret) {
    rows.push(missing("AUTH_SECRET", "Auth.js signing secret is required"));
  } else if (authSecret.length < 32 || isFakeLooking(authSecret)) {
    rows.push(blocker("AUTH_SECRET", "missing production entropy or fake-looking"));
  } else {
    rows.push(configured("AUTH_SECRET", "present with plausible length"));
  }

  const authUrl = clean("AUTH_URL");
  if (!authUrl) {
    rows.push(missing("AUTH_URL", "canonical production URL is required"));
  } else if (!isHttpsUrl(authUrl) || isFakeLooking(authUrl)) {
    rows.push(blocker("AUTH_URL", "must be an HTTPS production URL"));
  } else {
    rows.push(configured("AUTH_URL", "HTTPS URL-shaped"));
  }

  rows.push(checkRequiredPresence("AUTH_GOOGLE_ID", "Google Workspace SSO client ID is required"));
  rows.push(checkRequiredPresence("AUTH_GOOGLE_SECRET", "Google Workspace SSO client secret is required"));

  const allowedDomain = clean("AUTH_ALLOWED_DOMAIN").toLowerCase();
  if (!allowedDomain) {
    rows.push(missing("AUTH_ALLOWED_DOMAIN", "Tropenbos Workspace domain restriction is required"));
  } else if (!isDomainLike(allowedDomain) || !allowedDomain.includes("tropenbos")) {
    rows.push(blocker("AUTH_ALLOWED_DOMAIN", "must be a Tropenbos-owned domain"));
  } else {
    rows.push(configured("AUTH_ALLOWED_DOMAIN", "Tropenbos domain-shaped"));
  }

  return rows;
}

function checkSupabase() {
  return [
    checkConnectionUrl("DATABASE_URL"),
    checkConnectionUrl("DIRECT_URL"),
    checkRequiredPresence("NEXT_PUBLIC_SUPABASE_URL", "browser upload/storage paths need the Supabase project URL"),
    checkRequiredPresence("NEXT_PUBLIC_SUPABASE_ANON_KEY", "browser upload/storage paths need the anon key"),
    has("SUPABASE_SERVICE_ROLE_KEY")
      ? configured("SUPABASE_SERVICE_ROLE_KEY", "present for server-side jobs/storage")
      : warning("SUPABASE_SERVICE_ROLE_KEY", "missing - server-side storage/job paths may be disabled"),
  ];
}

function checkGeminiGovernance() {
  return [
    checkRequiredPresence("GOOGLE_GENERATIVE_AI_API_KEY", "Gemini generation, embeddings, grounding, and guard checks require it"),
    configured("lib/governance/gate.ts", "hard gate remains the AI-layer enforcement point"),
    configured("evidence classifications", "only public_published may reach Gemini; community_sourced and unpublished_internal stay blocked"),
  ];
}

function checkUploadthing() {
  return [checkRequiredPresence("UPLOADTHING_TOKEN", "document ingestion uploads require it")];
}

function checkInngest() {
  return [
    checkRequiredPresence("INNGEST_EVENT_KEY", "scheduled and event-triggered jobs require it"),
    checkRequiredPresence("INNGEST_SIGNING_KEY", "the Inngest serve endpoint requires request verification"),
  ];
}

function checkEmail() {
  const rows = [
    checkRequiredPresence("RESEND_API_KEY", "morning digest email requires it"),
  ];
  const from = clean("DIGEST_FROM_EMAIL");
  if (!from) rows.push(missing("DIGEST_FROM_EMAIL", "verified digest sender is required"));
  else if (!isEmailLike(from) || isFakeLooking(from)) rows.push(blocker("DIGEST_FROM_EMAIL", "must be a production sender address"));
  else rows.push(configured("DIGEST_FROM_EMAIL", "email-shaped"));
  return rows;
}

function checkExports() {
  const rows = [];
  const hasGoogleOAuth = has("AUTH_GOOGLE_ID") && has("AUTH_GOOGLE_SECRET");
  const driveKey = clean("DRIVE_TOKEN_ENCRYPTION_KEY");

  if (hasGoogleOAuth && driveKey && isBase64Bytes(driveKey, 32)) {
    rows.push(configured("Google Docs export", "OAuth vars and 32-byte Drive token key are present"));
  } else if (hasGoogleOAuth && !driveKey) {
    rows.push(warning("DRIVE_TOKEN_ENCRYPTION_KEY", "missing - Google Docs export disabled"));
  } else if (driveKey && !isBase64Bytes(driveKey, 32)) {
    rows.push(warning("DRIVE_TOKEN_ENCRYPTION_KEY", "invalid shape - expected base64 for 32 bytes"));
  } else {
    rows.push(warning("Google Docs export", "not configured"));
  }

  const pandoc = clean("PANDOC_BIN");
  if (pandoc && isExecutable(pandoc)) {
    rows.push(configured("PANDOC_BIN", "executable locally"));
  } else if (pandoc) {
    rows.push(warning("PANDOC_BIN", "set but not executable locally"));
  } else {
    rows.push(warning("PANDOC_BIN", "not configured - Vercel does not ship Pandoc by default"));
  }

  rows.push(
    has("PANDOC_PDF_ENGINE")
      ? configured("PANDOC_PDF_ENGINE", "present")
      : warning("PANDOC_PDF_ENGINE", "missing - application default applies when Pandoc is enabled"),
  );

  return rows;
}

function allOrPartial(keys) {
  const present = keys.filter(has);
  if (present.length === keys.length) return "all";
  if (present.length > 0) return "partial";
  return "none";
}

function checkWhatsApp() {
  const keys = [
    "WHATSAPP_API_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_WEBHOOK_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
  ];
  const state = allOrPartial(keys);

  if (state === "all") {
    return [configured("WhatsApp Cloud API", "send credentials and webhook verification vars are present")];
  }

  if (state === "partial") {
    return keys.map((key) =>
      has(key)
        ? configured(key, "present")
        : warning(key, "missing - WhatsApp is only partially configured"),
    );
  }

  return [warning("WhatsApp Cloud API", "not configured")];
}

function checkUssd() {
  const rows = [];
  const inboundState = allOrPartial(["AFRICASTALKING_USSD_SECRET", "USSD_SERVICE_CODE"]);
  const serviceCode = clean("USSD_SERVICE_CODE");

  if (inboundState === "all") {
    rows.push(configured("USSD inbound callback", "path secret and service code are present"));
    if (serviceCode && !serviceCode.endsWith("#")) {
      rows.push(warning("USSD_SERVICE_CODE", "does not end with # - quote it in dotenv syntax"));
    }
  } else if (inboundState === "partial") {
    rows.push(warning("USSD inbound callback", "partially configured"));
  } else {
    rows.push(warning("USSD inbound callback", "not configured"));
  }

  const outboundState = allOrPartial(["AFRICASTALKING_USERNAME", "AFRICASTALKING_API_KEY"]);
  if (outboundState === "all") {
    rows.push(configured("Africa's Talking outbound", "future outbound credentials are present"));
  } else if (outboundState === "partial") {
    rows.push(warning("Africa's Talking outbound", "partially configured - future outbound only"));
  } else {
    rows.push(warning("Africa's Talking outbound", "not configured - not required for inbound USSD"));
  }

  return rows;
}

function checkSentry() {
  const rows = [];
  rows.push(has("SENTRY_DSN") ? configured("SENTRY_DSN", "server runtime reporting configured") : warning("SENTRY_DSN", "not configured"));
  rows.push(has("NEXT_PUBLIC_SENTRY_DSN") ? configured("NEXT_PUBLIC_SENTRY_DSN", "browser reporting configured") : warning("NEXT_PUBLIC_SENTRY_DSN", "not configured"));
  rows.push(has("SENTRY_AUTH_TOKEN") ? configured("SENTRY_AUTH_TOKEN", "source-map upload opt-in is present") : warning("SENTRY_AUTH_TOKEN", "not configured - source-map upload stays off"));
  return rows;
}

function checkPostHog() {
  const key = has("NEXT_PUBLIC_POSTHOG_KEY");
  const host = has("NEXT_PUBLIC_POSTHOG_HOST");

  if (key && host) return [configured("PostHog", "self-hosted key and host are present")];
  if (key && !host) return [warning("NEXT_PUBLIC_POSTHOG_HOST", "missing - there is no PostHog Cloud fallback")];
  if (!key && host) return [warning("NEXT_PUBLIC_POSTHOG_KEY", "missing while host is present")];
  return [warning("PostHog", "not configured")];
}

function checkSlack() {
  return [
    has("SLACK_WEBHOOK_URL")
      ? configured("SLACK_WEBHOOK_URL", "optional signal digest destination present")
      : warning("SLACK_WEBHOOK_URL", "not configured - optional"),
  ];
}

function checkVercel() {
  const rows = [];
  const projectJson = path.join(root, ".vercel", "project.json");
  const repoJson = path.join(root, ".vercel", "repo.json");

  if (existsSync(projectJson)) {
    rows.push(configured(".vercel/project.json", "local project linkage file exists; ids intentionally hidden"));
  } else if (existsSync(repoJson)) {
    rows.push(configured(".vercel/repo.json", "local repo linkage file exists; ids intentionally hidden"));
  } else {
    rows.push(warning("Vercel linkage", "not locally linked - link/deploy later through an explicit deployment prompt"));
  }

  const planAck = clean("EVIBRIEF_VERCEL_PRODUCTION_PLAN_ACK");
  if (planAck === "non_hobby") {
    rows.push(configured("EVIBRIEF_VERCEL_PRODUCTION_PLAN_ACK", "operator acknowledged a non-Hobby production plan"));
  } else {
    rows.push(blocker("EVIBRIEF_VERCEL_PRODUCTION_PLAN_ACK", "set to non_hobby after confirming Tropenbos production is not on Vercel Hobby"));
  }

  rows.push(warning("Vercel deployment", "this command does not deploy; use preview first unless production is explicitly requested"));
  return rows;
}

console.log("EviBrief production deployment preflight");
console.log("Credential-safe local readiness report; no provider APIs are contacted.");
console.log("This script does not inspect evidence rows, brief prose, prompts, completions, translations, search queries, stakeholder notes, or field observations.");
console.log("Secret values, token fragments, connection strings, Vercel ids, and evidence text are never printed.");

section("Core app / Auth.js", checkCoreAuth());
section("Supabase / Prisma", checkSupabase());
section("Gemini / AI governance", checkGeminiGovernance());
section("Ingestion / Uploadthing", checkUploadthing());
section("Inngest jobs", checkInngest());
section("Email / Resend", checkEmail());
section("Exports / Google Drive / Pandoc", checkExports());
section("WhatsApp Cloud API", checkWhatsApp());
section("USSD", checkUssd());
section("Sentry", checkSentry());
section("PostHog", checkPostHog());
section("Slack digest destination", checkSlack());
section("Vercel deployment account manual checks", checkVercel());

console.log("\nSummary");
console.log("-------");
console.log(`Blockers: ${counts.blockers}`);
console.log(`Warnings: ${counts.warnings}`);
console.log(`Configured checks: ${counts.configured}`);

if (counts.blockers > 0) {
  console.log("\nResult: blocked for production deployment readiness.");
  process.exitCode = 1;
} else {
  console.log("\nResult: no production-critical blockers detected by local preflight.");
}
