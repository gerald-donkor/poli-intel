// Author a Prisma migration without `prisma migrate dev`.
//
// Why this exists: Prisma cannot express an HNSW index in schema.prisma — there
// is no `hnsw` index type in the ORM. The pgvector similarity indexes therefore
// look to Prisma like objects the schema does not declare, so every diff
// proposes dropping them. `prisma migrate dev` would write that DROP into the
// migration it generates, and the next deploy would leave both vector columns
// unindexed — turning every retrieval into a sequential scan (AGENTS.md §15.1,
// `supabase-schema`).
//
// This script diffs the live database against schema.prisma, removes the
// spurious vector-index drops, and writes the result to a migration file for
// review. It never applies anything; `npm run db:migrate` does that.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Index names matching this pattern are created by hand-written migration SQL
 * and are invisible to Prisma's datamodel. A diff can only ever propose
 * dropping them spuriously, so a drop is never carried into a migration.
 * Name every pgvector similarity index `<table>_<column>_cosine_idx`.
 */
const PROTECTED_INDEX = /_embedding_cosine_idx/;

const name = process.argv[2];

if (!name || !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(name)) {
  console.error(
    "Usage: npm run db:migrate:new -- <snake_case_name>\n" +
      "Example: npm run db:migrate:new -- add_stakeholder_notes",
  );
  process.exit(1);
}

const prisma = join("node_modules", ".bin", "prisma");

const sql = execFileSync(
  prisma,
  [
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "./prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8" },
);

// Prisma emits each statement as a `-- DropIndex` comment followed by the DDL.
// Drop both lines together so no orphaned comment survives.
const kept = [];
const removed = [];
const lines = sql.split("\n");

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];

  if (line.startsWith("DROP INDEX") && PROTECTED_INDEX.test(line)) {
    removed.push(line.trim());
    if (kept.at(-1)?.startsWith("-- DropIndex")) kept.pop();
    continue;
  }

  kept.push(line);
}

const body = kept.join("\n").trim();

if (removed.length > 0) {
  console.log(
    `Dropped ${removed.length} spurious vector-index statement(s) from the diff:`,
  );
  for (const statement of removed) console.log(`  ${statement}`);
  console.log("");
}

if (body === "") {
  console.log("No schema changes to migrate. Nothing written.");
  process.exit(0);
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 14);

const dir = join("prisma", "migrations", `${stamp}_${name}`);
const file = join(dir, "migration.sql");

mkdirSync(dir, { recursive: true });
writeFileSync(
  file,
  `-- Authored by scripts/new-migration.mjs from the live database diff.\n` +
    `-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its\n` +
    `-- HNSW cosine index here by hand — Prisma cannot generate one.\n\n` +
    `${body}\n`,
);

console.log(`Wrote ${file}`);
console.log("Review it, then apply with: npm run db:migrate");
