-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateTable
CREATE TABLE "brief_translation" (
    "id" TEXT NOT NULL,
    "brief_version_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "messages_json" JSONB NOT NULL,
    "generating_model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "translated_by_id" TEXT,
    "translated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brief_translation_translated_by_id_idx" ON "brief_translation"("translated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "brief_translation_brief_version_id_language_key" ON "brief_translation"("brief_version_id", "language");

-- AddForeignKey
ALTER TABLE "brief_translation" ADD CONSTRAINT "brief_translation_brief_version_id_fkey" FOREIGN KEY ("brief_version_id") REFERENCES "brief_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_translation" ADD CONSTRAINT "brief_translation_translated_by_id_fkey" FOREIGN KEY ("translated_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
