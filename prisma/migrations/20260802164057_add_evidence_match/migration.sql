-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateEnum
CREATE TYPE "evidence_match_outcome" AS ENUM ('matched', 'gap', 'failed');



-- CreateTable
CREATE TABLE "evidence_match_run" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "outcome" "evidence_match_outcome" NOT NULL,
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "refused_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "evidence_match_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_evidence_match" (
    "signal_id" TEXT NOT NULL,
    "evidence_item_id" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "rerank_score" DOUBLE PRECISION,
    "rank" INTEGER NOT NULL,
    "chunk_ordinal" INTEGER NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_evidence_match_pkey" PRIMARY KEY ("signal_id","evidence_item_id")
);

-- CreateIndex
CREATE INDEX "evidence_match_run_signal_id_started_at_idx" ON "evidence_match_run"("signal_id", "started_at");

-- CreateIndex
CREATE INDEX "signal_evidence_match_evidence_item_id_idx" ON "signal_evidence_match"("evidence_item_id");

-- AddForeignKey
ALTER TABLE "evidence_match_run" ADD CONSTRAINT "evidence_match_run_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_evidence_match" ADD CONSTRAINT "signal_evidence_match_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_evidence_match" ADD CONSTRAINT "signal_evidence_match_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
