-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- AlterTable
ALTER TABLE "brief_generation" ADD COLUMN     "signal_id" TEXT;

-- CreateIndex
CREATE INDEX "brief_generation_signal_id_idx" ON "brief_generation"("signal_id");

-- AddForeignKey
ALTER TABLE "brief_generation" ADD CONSTRAINT "brief_generation_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
