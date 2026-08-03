-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.
--
-- NO VECTOR COLUMN IS ADDED HERE, so there is no HNSW index to write in.
--
-- THE NOT NULL ADDS AND THE event_type DROP/RE-ADD BELOW CARRY NO DEFAULT AND
-- NO BACKFILL, WHICH IS SAFE ONLY BECAUSE `influence_event` HAS NEVER BEEN
-- WRITTEN TO. The table was created by 20260730100000_init and no code has
-- referenced it since — the Impact Tracker is its first writer. Rewriting
-- `event_type` from a bare TEXT column into an enum is therefore a definition
-- change over an empty table, not a data migration. If this ever has to be
-- replayed against a database that does hold rows, it needs a backfill first.

-- CreateEnum
CREATE TYPE "influence_event_type" AS ENUM ('policy_citation', 'legislation_aligned', 'company_commitment', 'dialogue_outcome', 'national_strategy');

-- CreateEnum
CREATE TYPE "influence_detection_method" AS ENUM ('logged_by_person', 'detected_by_search');

-- CreateEnum
CREATE TYPE "impact_detection_outcome" AS ENUM ('found', 'empty', 'failed');



-- AlterTable
ALTER TABLE "influence_event" ADD COLUMN     "detection_method" "influence_detection_method" NOT NULL,
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "logged_by_id" TEXT,
ADD COLUMN     "quoted_text" TEXT,
ADD COLUMN     "source_key" TEXT,
ADD COLUMN     "source_title" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" TEXT,
DROP COLUMN "event_type",
ADD COLUMN     "event_type" "influence_event_type" NOT NULL;

-- CreateTable
CREATE TABLE "impact_detection_run" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "outcome" "impact_detection_outcome" NOT NULL,
    "candidates_seen" INTEGER NOT NULL DEFAULT 0,
    "events_created" INTEGER NOT NULL DEFAULT 0,
    "events_matched" INTEGER NOT NULL DEFAULT 0,
    "candidates_dropped" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_detection_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impact_detection_run_brief_id_started_at_idx" ON "impact_detection_run"("brief_id", "started_at");

-- CreateIndex
CREATE INDEX "influence_event_verified_detected_at_idx" ON "influence_event"("verified", "detected_at");

-- CreateIndex
CREATE INDEX "influence_event_created_at_idx" ON "influence_event"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "influence_event_brief_id_source_key_key" ON "influence_event"("brief_id", "source_key");

-- AddForeignKey
ALTER TABLE "influence_event" ADD CONSTRAINT "influence_event_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influence_event" ADD CONSTRAINT "influence_event_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_detection_run" ADD CONSTRAINT "impact_detection_run_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
