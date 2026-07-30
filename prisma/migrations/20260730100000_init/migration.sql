-- EviBrief init migration.
--
-- Hand-extended after generation, in this order:
--   1. the pgvector extension (below) — it must exist before any table with a
--      `vector` column is created;
--   2. the Prisma-generated tables, enums and indexes;
--   3. the cosine similarity indexes at the end of this file.
-- Both extensions and vector indexes are migration content. Never applied by
-- hand in the Supabase SQL editor (AGENTS.md §12.6).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
-- Explicit, not assumed on. Vector columns below are `vector(1536)`.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "urgency" AS ENUM ('immediate', 'near_term', 'horizon', 'watch');

-- CreateEnum
CREATE TYPE "relevance" AS ENUM ('core', 'adjacent', 'background');

-- CreateEnum
CREATE TYPE "impact_area" AS ENUM ('restoration', 'community_forestry', 'diversified_production', 'cross_cutting');

-- CreateEnum
CREATE TYPE "geography" AS ENUM ('ghana_national', 'cocoa_belt_landscapes', 'international', 'multi_level');

-- CreateEnum
CREATE TYPE "audience_target" AS ENUM ('ministry', 'cocobod', 'eu_institutions', 'private_sector', 'community_governance');

-- CreateEnum
CREATE TYPE "brief_type" AS ENUM ('policy_brief', 'technical_submission', 'position_paper', 'stakeholder_note', 'media_backgrounder');

-- CreateEnum
CREATE TYPE "brief_status" AS ENUM ('draft', 'reviewed', 'submitted', 'published');

-- CreateEnum
CREATE TYPE "signal_status" AS ENUM ('new', 'reviewed', 'actioned', 'archived');

-- CreateEnum
CREATE TYPE "evidence_source_type" AS ENUM ('field_data', 'research', 'literature');

-- CreateEnum
CREATE TYPE "classification" AS ENUM ('public_published', 'community_sourced', 'unpublished_internal');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('programme_director', 'policy_advocacy_officer', 'research_officer', 'field_officer');

-- CreateEnum
CREATE TYPE "flag_reason" AS ENUM ('unsupported', 'altered', 'misattributed');

-- CreateEnum
CREATE TYPE "flag_status" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ingestion_outcome" AS ENUM ('succeeded', 'failed');

-- CreateTable
CREATE TABLE "staff_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_signal" (
    "id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "urgency" "urgency" NOT NULL,
    "relevance" "relevance" NOT NULL,
    "impact_area" "impact_area" NOT NULL,
    "geography" "geography" NOT NULL,
    "summary_text" TEXT NOT NULL,
    "status" "signal_status" NOT NULL DEFAULT 'new',
    "embedding" vector(1536),
    "embedding_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "year" INTEGER,
    "source_type" "evidence_source_type" NOT NULL,
    "country" TEXT,
    "impact_area" "impact_area",
    "full_text" TEXT NOT NULL,
    "citation_key" TEXT NOT NULL,
    "classification" "classification" NOT NULL DEFAULT 'unpublished_internal',
    "source_url" TEXT,
    "source_file_name" TEXT,
    "ingested_by_id" TEXT,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_chunk" (
    "id" TEXT NOT NULL,
    "evidence_item_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "char_start" INTEGER NOT NULL,
    "char_end" INTEGER NOT NULL,
    "source_page" INTEGER,
    "embedding" vector(1536),
    "embedding_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brief" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT,
    "brief_type" "brief_type" NOT NULL,
    "audience" "audience_target" NOT NULL,
    "status" "brief_status" NOT NULL DEFAULT 'draft',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brief_evidence" (
    "brief_id" TEXT NOT NULL,
    "evidence_item_id" TEXT NOT NULL,
    "relevance_score" DOUBLE PRECISION,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_evidence_pkey" PRIMARY KEY ("brief_id","evidence_item_id")
);

-- CreateTable
CREATE TABLE "brief_version" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body_text" TEXT NOT NULL,
    "document_json" JSONB,
    "generating_model" TEXT,
    "prompt_version" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hallucination_flag" (
    "id" TEXT NOT NULL,
    "brief_version_id" TEXT NOT NULL,
    "anchor_from" INTEGER NOT NULL,
    "anchor_to" INTEGER NOT NULL,
    "claim_text" TEXT NOT NULL,
    "reason" "flag_reason" NOT NULL,
    "checked_evidence_item_ids" TEXT[],
    "status" "flag_status" NOT NULL DEFAULT 'open',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hallucination_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influence_event" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "source_document" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influence_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT,
    "role" TEXT,
    "audience_type" "audience_target",
    "preferred_language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholder_brief" (
    "stakeholder_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "stakeholder_brief_pkey" PRIMARY KEY ("stakeholder_id","brief_id")
);

-- CreateTable
CREATE TABLE "brief_status_change" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_status" "brief_status",
    "new_status" "brief_status" NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_reclassification" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_urgency" "urgency" NOT NULL,
    "new_urgency" "urgency" NOT NULL,
    "previous_relevance" "relevance" NOT NULL,
    "new_relevance" "relevance" NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_reclassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_classification_change" (
    "id" TEXT NOT NULL,
    "evidence_item_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_classification" "classification" NOT NULL,
    "new_classification" "classification" NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_classification_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_log" (
    "id" TEXT NOT NULL,
    "evidence_item_id" TEXT,
    "source_name" TEXT NOT NULL,
    "source_type" "evidence_source_type",
    "outcome" "ingestion_outcome" NOT NULL,
    "extracted_chars" INTEGER,
    "chunk_count" INTEGER,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_email_key" ON "staff_user"("email");

-- CreateIndex
CREATE INDEX "policy_signal_status_idx" ON "policy_signal"("status");

-- CreateIndex
CREATE INDEX "policy_signal_urgency_idx" ON "policy_signal"("urgency");

-- CreateIndex
CREATE INDEX "policy_signal_detected_at_idx" ON "policy_signal"("detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_item_citation_key_key" ON "evidence_item"("citation_key");

-- CreateIndex
CREATE INDEX "evidence_item_classification_idx" ON "evidence_item"("classification");

-- CreateIndex
CREATE INDEX "evidence_item_impact_area_idx" ON "evidence_item"("impact_area");

-- CreateIndex
CREATE INDEX "evidence_item_source_type_idx" ON "evidence_item"("source_type");

-- CreateIndex
CREATE INDEX "evidence_item_country_year_idx" ON "evidence_item"("country", "year");

-- CreateIndex
CREATE INDEX "evidence_item_ingested_by_id_idx" ON "evidence_item"("ingested_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_chunk_evidence_item_id_ordinal_key" ON "evidence_chunk"("evidence_item_id", "ordinal");

-- CreateIndex
CREATE INDEX "brief_status_idx" ON "brief"("status");

-- CreateIndex
CREATE INDEX "brief_signal_id_idx" ON "brief"("signal_id");

-- CreateIndex
CREATE INDEX "brief_created_by_id_idx" ON "brief"("created_by_id");

-- CreateIndex
CREATE INDEX "brief_reviewed_by_id_idx" ON "brief"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "brief_evidence_evidence_item_id_idx" ON "brief_evidence"("evidence_item_id");

-- CreateIndex
CREATE INDEX "brief_version_created_by_id_idx" ON "brief_version"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "brief_version_brief_id_version_key" ON "brief_version"("brief_id", "version");

-- CreateIndex
CREATE INDEX "hallucination_flag_brief_version_id_status_idx" ON "hallucination_flag"("brief_version_id", "status");

-- CreateIndex
CREATE INDEX "hallucination_flag_resolved_by_id_idx" ON "hallucination_flag"("resolved_by_id");

-- CreateIndex
CREATE INDEX "influence_event_brief_id_idx" ON "influence_event"("brief_id");

-- CreateIndex
CREATE INDEX "stakeholder_brief_brief_id_idx" ON "stakeholder_brief"("brief_id");

-- CreateIndex
CREATE INDEX "brief_status_change_brief_id_idx" ON "brief_status_change"("brief_id");

-- CreateIndex
CREATE INDEX "brief_status_change_actor_id_idx" ON "brief_status_change"("actor_id");

-- CreateIndex
CREATE INDEX "signal_reclassification_signal_id_idx" ON "signal_reclassification"("signal_id");

-- CreateIndex
CREATE INDEX "signal_reclassification_actor_id_idx" ON "signal_reclassification"("actor_id");

-- CreateIndex
CREATE INDEX "evidence_classification_change_evidence_item_id_idx" ON "evidence_classification_change"("evidence_item_id");

-- CreateIndex
CREATE INDEX "evidence_classification_change_actor_id_idx" ON "evidence_classification_change"("actor_id");

-- CreateIndex
CREATE INDEX "ingestion_log_evidence_item_id_idx" ON "ingestion_log"("evidence_item_id");

-- CreateIndex
CREATE INDEX "ingestion_log_created_at_idx" ON "ingestion_log"("created_at");

-- AddForeignKey
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_ingested_by_id_fkey" FOREIGN KEY ("ingested_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_chunk" ADD CONSTRAINT "evidence_chunk_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief" ADD CONSTRAINT "brief_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief" ADD CONSTRAINT "brief_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief" ADD CONSTRAINT "brief_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_evidence" ADD CONSTRAINT "brief_evidence_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_evidence" ADD CONSTRAINT "brief_evidence_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_version" ADD CONSTRAINT "brief_version_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_version" ADD CONSTRAINT "brief_version_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallucination_flag" ADD CONSTRAINT "hallucination_flag_brief_version_id_fkey" FOREIGN KEY ("brief_version_id") REFERENCES "brief_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallucination_flag" ADD CONSTRAINT "hallucination_flag_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influence_event" ADD CONSTRAINT "influence_event_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_brief" ADD CONSTRAINT "stakeholder_brief_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_brief" ADD CONSTRAINT "stakeholder_brief_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_status_change" ADD CONSTRAINT "brief_status_change_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_status_change" ADD CONSTRAINT "brief_status_change_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_reclassification" ADD CONSTRAINT "signal_reclassification_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_reclassification" ADD CONSTRAINT "signal_reclassification_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_classification_change" ADD CONSTRAINT "evidence_classification_change_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_classification_change" ADD CONSTRAINT "evidence_classification_change_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_log" ADD CONSTRAINT "ingestion_log_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateVectorIndex
-- Cosine distance, matching the retrieval order in AGENTS.md §15.1
-- (embed → pgvector cosine similarity → top 20 → rerank → top 8).
--
-- HNSW rather than IVFFlat: an IVFFlat index built on an empty table has no
-- meaningful centroids and must be rebuilt after data lands, whereas an HNSW
-- index is safe to build immediately after table creation
-- (https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes).
-- m and ef_construction are left at pgvector's defaults; there is no corpus to
-- tune against yet, and a guessed value is worse than a documented default.
--
-- 1536 dimensions is within pgvector's 2000-dimension index limit. Without
-- these indexes every retrieval degenerates into a sequential scan.
CREATE INDEX "evidence_chunk_embedding_cosine_idx"
  ON "evidence_chunk" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "policy_signal_embedding_cosine_idx"
  ON "policy_signal" USING hnsw ("embedding" vector_cosine_ops);
