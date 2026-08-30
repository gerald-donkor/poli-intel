-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateTable
CREATE TABLE "quarterly_evidence_narrative" (
    "id" TEXT NOT NULL,
    "quarter_key" VARCHAR(16) NOT NULL,
    "author_id" TEXT NOT NULL,
    "wins" TEXT NOT NULL,
    "missed_windows" TEXT NOT NULL,
    "evidence_gaps" TEXT NOT NULL,
    "system_improvement" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarterly_evidence_narrative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quarterly_evidence_narrative_quarter_key_key" ON "quarterly_evidence_narrative"("quarter_key");

-- AddForeignKey
ALTER TABLE "quarterly_evidence_narrative" ADD CONSTRAINT "quarterly_evidence_narrative_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
