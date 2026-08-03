-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- AlterTable
ALTER TABLE "evidence_item" ADD COLUMN     "location_note" TEXT,
ADD COLUMN     "observed_at" TIMESTAMP(3),
ADD COLUMN     "submission_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "evidence_item_submission_key_key" ON "evidence_item"("submission_key");
