#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  aiConfig: "lib/ai/config.ts",
  generationLimits: "lib/briefs/generation-limits.ts",
  translationLimits: "lib/briefs/translation-limits.ts",
  ingestionConfig: "lib/ingestion/config.ts",
  envExample: ".env.example",
};

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  try {
    return readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${relativePath}: ${error.message}`);
  }
}

const source = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => [
    key,
    readProjectFile(relativePath),
  ]),
);

function parseNumericLiteral(raw) {
  return Number(raw.replaceAll("_", ""));
}

function extractNumber(fileKey, name) {
  const pattern = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*([0-9][0-9_]*(?:\\.[0-9]+)?)\\s*(?:;|as\\s+const;)`,
  );
  const match = source[fileKey].match(pattern);

  if (!match) {
    throw new Error(
      `Required numeric constant ${name} was not found in ${files[fileKey]}.`,
    );
  }

  return parseNumericLiteral(match[1]);
}

function extractString(fileKey, name) {
  const pattern = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*"([^"]+)"\\s*(?:as\\s+const)?;`,
  );
  const match = source[fileKey].match(pattern);

  if (!match) {
    throw new Error(
      `Required string constant ${name} was not found in ${files[fileKey]}.`,
    );
  }

  return match[1];
}

function extractRequiredExport(fileKey, name) {
  if (!new RegExp(`\\b${name}\\b`).test(source[fileKey])) {
    throw new Error(
      `Required exported constant ${name} was not found in ${files[fileKey]}.`,
    );
  }
}

function readLocalDotenv(relativePath) {
  const envPath = path.join(root, relativePath);

  if (!existsSync(envPath)) {
    return {};
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  const parsed = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    let value = rest.join("=").trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key.trim()] = value;
  }

  return parsed;
}

function envStatus(key, localEnv) {
  const value =
    Object.prototype.hasOwnProperty.call(process.env, key) &&
    process.env[key] !== undefined
      ? process.env[key]
      : localEnv[key];

  return value ? "set" : "missing";
}

function printHeading(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printRows(rows) {
  const width = Math.max(...rows.map(([label]) => label.length));

  for (const [label, value] of rows) {
    console.log(`${label.padEnd(width)}  ${value}`);
  }
}

function requireConfigShape() {
  const requiredAiNumbers = [
    "EMBEDDING_DIMENSIONS",
    "GEMINI_RPM_BUDGET",
    "GEMINI_DAILY_REQUEST_BUDGET",
    "EMBEDDING_RPM_ALLOCATION",
    "EMBEDDING_MAX_INPUT_TOKENS_PER_REQUEST",
    "EMBEDDING_BATCH_SIZE",
    "EMBEDDING_SWEEP_ITEM_LIMIT",
    "GENERATION_TEMPERATURE",
    "GENERATION_MAX_OUTPUT_TOKENS",
    "GENERATION_EVIDENCE_EXCERPT_CHARS",
    "GENERATION_INVALID_OUTPUT_RETRIES",
    "RADAR_MAX_DOCUMENT_CHARS",
    "RADAR_MAX_ITEMS_PER_RUN",
    "RADAR_GEMINI_CALLS_PER_ITEM",
    "RADAR_GROUNDED_CALLS_PER_RUN",
    "RADAR_GROUNDED_RECENCY_DAYS",
    "RADAR_RPM_ALLOCATION",
    "IMPACT_RPM_ALLOCATION",
    "IMPACT_GROUNDED_CALLS_PER_BRIEF",
    "IMPACT_MAX_BRIEFS_PER_RUN",
    "IMPACT_DETECTION_WINDOW_DAYS",
    "IMPACT_SEARCH_RECENCY_DAYS",
    "MATCHER_CANDIDATE_ITEMS",
    "MATCHER_RERANK_EXCERPT_CHARS",
    "MATCHER_RPM_ALLOCATION",
  ];

  for (const name of requiredAiNumbers) {
    extractNumber("aiConfig", name);
  }

  for (const name of ["EMBEDDING_MODEL", "GENERATION_MODEL"]) {
    extractString("aiConfig", name);
  }

  for (const name of [
    "CHARS_PER_TOKEN_APPROX",
    "CHUNK_TARGET_TOKENS",
    "CHUNK_OVERLAP_TOKENS",
  ]) {
    extractNumber("ingestionConfig", name);
  }

  extractNumber("generationLimits", "BRIEF_POLICY_TEXT_MAX_CHARS");
  extractNumber("generationLimits", "GENERATION_EVIDENCE_CONTEXT_SIZE");
  extractNumber("translationLimits", "TRANSLATION_MAX_MESSAGES");
  extractString("translationLimits", "TRANSLATION_LANGUAGE");
  extractRequiredExport("aiConfig", "MATCHER_MATCH_SET_SIZE");
}

function collectConfig() {
  requireConfigShape();

  const cfg = {
    embeddingModel: extractString("aiConfig", "EMBEDDING_MODEL"),
    generationModel: extractString("aiConfig", "GENERATION_MODEL"),
    embeddingDimensions: extractNumber("aiConfig", "EMBEDDING_DIMENSIONS"),
    geminiRpmBudget: extractNumber("aiConfig", "GEMINI_RPM_BUDGET"),
    geminiDailyRequestBudget: extractNumber(
      "aiConfig",
      "GEMINI_DAILY_REQUEST_BUDGET",
    ),
    embeddingRpmAllocation: extractNumber(
      "aiConfig",
      "EMBEDDING_RPM_ALLOCATION",
    ),
    embeddingMaxInputTokensPerRequest: extractNumber(
      "aiConfig",
      "EMBEDDING_MAX_INPUT_TOKENS_PER_REQUEST",
    ),
    embeddingBatchSize: extractNumber("aiConfig", "EMBEDDING_BATCH_SIZE"),
    embeddingSweepItemLimit: extractNumber(
      "aiConfig",
      "EMBEDDING_SWEEP_ITEM_LIMIT",
    ),
    generationTemperature: extractNumber("aiConfig", "GENERATION_TEMPERATURE"),
    generationMaxOutputTokens: extractNumber(
      "aiConfig",
      "GENERATION_MAX_OUTPUT_TOKENS",
    ),
    generationEvidenceExcerptChars: extractNumber(
      "aiConfig",
      "GENERATION_EVIDENCE_EXCERPT_CHARS",
    ),
    generationInvalidOutputRetries: extractNumber(
      "aiConfig",
      "GENERATION_INVALID_OUTPUT_RETRIES",
    ),
    radarMaxDocumentChars: extractNumber("aiConfig", "RADAR_MAX_DOCUMENT_CHARS"),
    radarMaxItemsPerRun: extractNumber("aiConfig", "RADAR_MAX_ITEMS_PER_RUN"),
    radarGeminiCallsPerItem: extractNumber(
      "aiConfig",
      "RADAR_GEMINI_CALLS_PER_ITEM",
    ),
    radarGroundedCallsPerRun: extractNumber(
      "aiConfig",
      "RADAR_GROUNDED_CALLS_PER_RUN",
    ),
    radarGroundedRecencyDays: extractNumber(
      "aiConfig",
      "RADAR_GROUNDED_RECENCY_DAYS",
    ),
    radarRpmAllocation: extractNumber("aiConfig", "RADAR_RPM_ALLOCATION"),
    impactRpmAllocation: extractNumber("aiConfig", "IMPACT_RPM_ALLOCATION"),
    impactGroundedCallsPerBrief: extractNumber(
      "aiConfig",
      "IMPACT_GROUNDED_CALLS_PER_BRIEF",
    ),
    impactMaxBriefsPerRun: extractNumber(
      "aiConfig",
      "IMPACT_MAX_BRIEFS_PER_RUN",
    ),
    impactDetectionWindowDays: extractNumber(
      "aiConfig",
      "IMPACT_DETECTION_WINDOW_DAYS",
    ),
    impactSearchRecencyDays: extractNumber(
      "aiConfig",
      "IMPACT_SEARCH_RECENCY_DAYS",
    ),
    matcherCandidateItems: extractNumber("aiConfig", "MATCHER_CANDIDATE_ITEMS"),
    matcherRerankExcerptChars: extractNumber(
      "aiConfig",
      "MATCHER_RERANK_EXCERPT_CHARS",
    ),
    matcherRpmAllocation: extractNumber("aiConfig", "MATCHER_RPM_ALLOCATION"),
    charsPerTokenApprox: extractNumber("ingestionConfig", "CHARS_PER_TOKEN_APPROX"),
    chunkTargetTokens: extractNumber("ingestionConfig", "CHUNK_TARGET_TOKENS"),
    chunkOverlapTokens: extractNumber("ingestionConfig", "CHUNK_OVERLAP_TOKENS"),
    briefPolicyTextMaxChars: extractNumber(
      "generationLimits",
      "BRIEF_POLICY_TEXT_MAX_CHARS",
    ),
    generationEvidenceContextSize: extractNumber(
      "generationLimits",
      "GENERATION_EVIDENCE_CONTEXT_SIZE",
    ),
    translationMaxMessages: extractNumber(
      "translationLimits",
      "TRANSLATION_MAX_MESSAGES",
    ),
    translationLanguage: extractString("translationLimits", "TRANSLATION_LANGUAGE"),
  };

  cfg.embeddingMaxBatchChars = Math.floor(
    cfg.embeddingMaxInputTokensPerRequest * 0.6 * cfg.charsPerTokenApprox,
  );
  cfg.radarWorstCaseRequestsPerRun =
    cfg.radarGroundedCallsPerRun +
    cfg.radarMaxItemsPerRun * cfg.radarGeminiCallsPerItem;
  cfg.radarFetchRunsPerMinute = Math.max(
    1,
    Math.floor(cfg.radarRpmAllocation / cfg.radarWorstCaseRequestsPerRun),
  );
  cfg.impactDetectionRunsPerMinute = Math.max(
    1,
    Math.floor(cfg.impactRpmAllocation / cfg.impactGroundedCallsPerBrief),
  );
  cfg.impactWorstCaseRequestsPerWeeklyRun =
    cfg.impactMaxBriefsPerRun * cfg.impactGroundedCallsPerBrief;
  cfg.matcherRunsPerMinute = cfg.matcherRpmAllocation;

  return cfg;
}

function envCategories() {
  return {
    "Gemini AI": ["GOOGLE_GENERATIVE_AI_API_KEY"],
    "Supabase and Prisma": [
      "DATABASE_URL",
      "DIRECT_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    "Auth.js and Google Workspace": [
      "AUTH_SECRET",
      "AUTH_URL",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
      "AUTH_ALLOWED_DOMAIN",
    ],
    "Google Docs export": ["DRIVE_TOKEN_ENCRYPTION_KEY"],
    "PDF export": ["PANDOC_BIN", "PANDOC_PDF_ENGINE"],
    Inngest: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
    Email: ["RESEND_API_KEY", "DIGEST_FROM_EMAIL"],
    Uploads: ["UPLOADTHING_TOKEN"],
    "Digest integrations": ["SLACK_WEBHOOK_URL"],
    WhatsApp: [
      "WHATSAPP_API_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_WEBHOOK_SECRET",
      "WHATSAPP_VERIFY_TOKEN",
    ],
    USSD: [
      "AFRICASTALKING_USERNAME",
      "AFRICASTALKING_API_KEY",
      "AFRICASTALKING_USSD_SECRET",
      "USSD_SERVICE_CODE",
    ],
    Sentry: ["SENTRY_DSN", "SENTRY_AUTH_TOKEN", "NEXT_PUBLIC_SENTRY_DSN"],
    PostHog: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
  };
}

function assertEnvListIsCovered() {
  const keysInExample = [...source.envExample.matchAll(/^([A-Z0-9_]+)=/gm)].map(
    ([, key]) => key,
  );
  const covered = new Set(Object.values(envCategories()).flat());
  const uncovered = keysInExample.filter((key) => !covered.has(key));

  if (uncovered.length > 0) {
    throw new Error(
      `The scale review env categories do not cover .env.example keys: ${uncovered.join(", ")}`,
    );
  }
}

function main() {
  const cfg = collectConfig();
  assertEnvListIsCovered();

  const localEnv = readLocalDotenv(".env.local");

  console.log("EviBrief AI stack scale review");
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("Scope: local source/env readiness only; no network, database, or AI calls.");

  printHeading("Models and Core Budgets");
  printRows([
    ["Generation model", cfg.generationModel],
    ["Embedding model", cfg.embeddingModel],
    ["Embedding dimensions", String(cfg.embeddingDimensions)],
    ["Gemini RPM design budget", `${cfg.geminiRpmBudget} requests/minute`],
    [
      "Gemini daily design budget",
      `${cfg.geminiDailyRequestBudget} requests/day`,
    ],
    ["Generation temperature", String(cfg.generationTemperature)],
    ["Generation output cap", `${cfg.generationMaxOutputTokens} tokens`],
  ]);

  printHeading("Embedding Envelope");
  printRows([
    ["Chunk target", `${cfg.chunkTargetTokens} tokens`],
    ["Chunk overlap", `${cfg.chunkOverlapTokens} tokens`],
    ["Batch size", `${cfg.embeddingBatchSize} chunks/request`],
    [
      "Batch token ceiling",
      `${cfg.embeddingMaxInputTokensPerRequest} tokens/request`,
    ],
    ["Batch char safety cap", `${cfg.embeddingMaxBatchChars} chars/request`],
    ["Sweep item limit", `${cfg.embeddingSweepItemLimit} evidence items/run`],
    [
      "RPM allocation",
      `${cfg.embeddingRpmAllocation} of ${cfg.geminiRpmBudget} requests/minute`,
    ],
  ]);

  printHeading("Interactive Brief Envelope");
  printRows([
    [
      "Policy paste cap",
      `${cfg.briefPolicyTextMaxChars} chars before generation`,
    ],
    [
      "Evidence context",
      `${cfg.generationEvidenceContextSize} items x ${cfg.generationEvidenceExcerptChars} chars`,
    ],
    [
      "Generation + guard",
      "at least 2 Gemini requests before a reviewable draft is persisted",
    ],
    [
      "Invalid structured output",
      `${cfg.generationInvalidOutputRetries} retry before failed generation`,
    ],
    [
      "Audience switcher",
      "1 Gemini request plus the same evidence-governance gate",
    ],
    [
      "Translation assist",
      `${cfg.translationMaxMessages} key messages to ${cfg.translationLanguage}`,
    ],
  ]);

  printHeading("Radar Envelope");
  printRows([
    ["Fetched document cap", `${cfg.radarMaxDocumentChars} chars/item`],
    ["Items per source run", String(cfg.radarMaxItemsPerRun)],
    ["Classification + embedding", `${cfg.radarGeminiCallsPerItem} requests/item`],
    ["Grounded search fixed cost", `${cfg.radarGroundedCallsPerRun} requests/run`],
    ["Grounded recency", `${cfg.radarGroundedRecencyDays} days`],
    [
      "Worst-case source run",
      `${cfg.radarWorstCaseRequestsPerRun} Gemini requests`,
    ],
    [
      "Run starts",
      `${cfg.radarFetchRunsPerMinute}/minute from ${cfg.radarRpmAllocation} RPM allocation`,
    ],
  ]);

  printHeading("Evidence Matcher Envelope");
  printRows([
    ["Candidates reranked", String(cfg.matcherCandidateItems)],
    ["Excerpt per candidate", `${cfg.matcherRerankExcerptChars} chars`],
    ["Gemini requests per run", "1 rerank request; retrieval is SQL"],
    [
      "Run starts",
      `${cfg.matcherRunsPerMinute}/minute from ${cfg.matcherRpmAllocation} RPM allocation`,
    ],
    [
      "Stored match set",
      `${cfg.generationEvidenceContextSize} items for generation context`,
    ],
  ]);

  printHeading("Impact Tracker Envelope");
  printRows([
    ["Briefs per weekly run", String(cfg.impactMaxBriefsPerRun)],
    ["Requests per brief", String(cfg.impactGroundedCallsPerBrief)],
    [
      "Worst-case weekly run",
      `${cfg.impactWorstCaseRequestsPerWeeklyRun} Gemini requests`,
    ],
    [
      "Run starts",
      `${cfg.impactDetectionRunsPerMinute}/minute from ${cfg.impactRpmAllocation} RPM allocation`,
    ],
    ["Detection window", `${cfg.impactDetectionWindowDays} days`],
    ["Search recency", `${cfg.impactSearchRecencyDays} days`],
  ]);

  printHeading("Environment Presence");
  for (const [category, keys] of Object.entries(envCategories())) {
    console.log(`\n${category}`);
    printRows(keys.map((key) => [key, envStatus(key, localEnv)]));
  }

  printHeading("Manual Checks Still Required");
  console.log("- Google AI Studio: active RPM, TPM, RPD, grounded-search availability, and billing tier.");
  console.log("- Supabase dashboard: database size, disk/read-only state, project inactivity pause risk, backups.");
  console.log("- Vercel dashboard: plan, commercial eligibility, function duration, runtime logs, and usage.");
  console.log("- Production traffic: actual daily generations, radar source count, ingest backlog, and weekly impact backlog.");
  console.log("- Governance: confirm no community_sourced or unpublished_internal evidence is sent to Gemini.");
}

try {
  main();
} catch (error) {
  console.error(`AI stack scale review failed: ${error.message}`);
  process.exitCode = 1;
}
