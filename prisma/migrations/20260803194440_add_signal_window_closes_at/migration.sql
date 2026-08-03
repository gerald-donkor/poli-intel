-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- AlterTable
ALTER TABLE "policy_signal" ADD COLUMN     "window_closes_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "policy_signal_window_closes_at_idx" ON "policy_signal"("window_closes_at");
