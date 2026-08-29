-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateEnum
CREATE TYPE "evidence_match_assessment" AS ENUM ('relevant', 'not_relevant', 'uncertain');



-- CreateTable
CREATE TABLE "evidence_match_review" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "evidence_item_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "assessment" "evidence_match_assessment" NOT NULL,
    "note" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_match_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_match_review_signal_id_evidence_item_id_reviewed_a_idx" ON "evidence_match_review"("signal_id", "evidence_item_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "evidence_match_review_evidence_item_id_reviewed_at_idx" ON "evidence_match_review"("evidence_item_id", "reviewed_at");

-- AddForeignKey
ALTER TABLE "evidence_match_review" ADD CONSTRAINT "evidence_match_review_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_match_review" ADD CONSTRAINT "evidence_match_review_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_match_review" ADD CONSTRAINT "evidence_match_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
