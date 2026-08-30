-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateTable
CREATE TABLE "brief_qa_review" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "brief_version" INTEGER NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "factual_grounding_checked" BOOLEAN NOT NULL DEFAULT false,
    "landscape_specificity_checked" BOOLEAN NOT NULL DEFAULT false,
    "audience_framing_checked" BOOLEAN NOT NULL DEFAULT false,
    "actionable_asks_checked" BOOLEAN NOT NULL DEFAULT false,
    "cross_cutting_themes_checked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brief_qa_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brief_qa_review_brief_id_idx" ON "brief_qa_review"("brief_id");

-- CreateIndex
CREATE INDEX "brief_qa_review_reviewer_id_idx" ON "brief_qa_review"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "brief_qa_review_brief_id_brief_version_reviewer_id_key" ON "brief_qa_review"("brief_id", "brief_version", "reviewer_id");

-- AddForeignKey
ALTER TABLE "brief_qa_review" ADD CONSTRAINT "brief_qa_review_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_qa_review" ADD CONSTRAINT "brief_qa_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
