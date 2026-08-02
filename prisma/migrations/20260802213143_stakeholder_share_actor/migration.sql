-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- AlterTable
ALTER TABLE "stakeholder_brief" ADD COLUMN     "shared_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "stakeholder_brief" ADD CONSTRAINT "stakeholder_brief_shared_by_id_fkey" FOREIGN KEY ("shared_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
