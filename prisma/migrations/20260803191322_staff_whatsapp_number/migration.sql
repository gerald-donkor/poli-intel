-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- AlterTable
ALTER TABLE "staff_user" ADD COLUMN     "whatsapp_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_whatsapp_number_key" ON "staff_user"("whatsapp_number");
