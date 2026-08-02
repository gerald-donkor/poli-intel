-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- REVIEWED. Two notes for anyone reading this later:
--
--   * `policy_signal.title` is added NOT NULL with no default, which is only
--     safe because nothing has ever written this table — the Policy Radar in
--     this migration is its first writer. On a populated table this statement
--     would fail outright, which is the safe direction: it stops rather than
--     backfilling a headline nobody chose.
--   * `policy_signal.audience_target` is nullable on purpose, unlike the four
--     classification columns beside it. Defaulting it would stamp an audience
--     on any pre-existing row, and a fabricated classification in front of a
--     reviewer is the thing this pipeline refuses to produce anywhere else.
--
-- No vector column is added here, so no HNSW index is at stake.

-- CreateEnum
CREATE TYPE "radar_outcome" AS ENUM ('found', 'empty', 'failed', 'not_implemented');



-- AlterTable
ALTER TABLE "policy_signal" ADD COLUMN     "audience_target" "audience_target",
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "radar_run" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "outcome" "radar_outcome" NOT NULL,
    "items_seen" INTEGER NOT NULL DEFAULT 0,
    "signals_created" INTEGER NOT NULL DEFAULT 0,
    "duplicates_suppressed" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "radar_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radar_run_source_id_started_at_idx" ON "radar_run"("source_id", "started_at");
