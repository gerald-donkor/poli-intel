-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateEnum
CREATE TYPE "brief_audience" AS ENUM ('ghana_ministry_official', 'cocoa_company_sustainability', 'eu_regulator', 'donor_programme_officer', 'crema_community_governance');

-- CreateEnum
CREATE TYPE "generation_stage" AS ENUM ('retrieving', 'drafting', 'verifying', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "generation_failure_reason" AS ENUM ('invalid_output', 'request_failed', 'missing_api_key');



-- AlterTable
ALTER TABLE "brief" DROP COLUMN "audience",
ADD COLUMN     "audience" "brief_audience" NOT NULL;

-- CreateTable
CREATE TABLE "brief_generation" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "brief_type" "brief_type" NOT NULL,
    "audience" "brief_audience" NOT NULL,
    "policy_text" TEXT NOT NULL,
    "evidence_item_ids" TEXT[],
    "stage" "generation_stage" NOT NULL DEFAULT 'retrieving',
    "failure_reason" "generation_failure_reason",
    "draft_json" JSONB,
    "generating_model" TEXT,
    "prompt_version" TEXT,
    "brief_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brief_generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brief_generation_brief_id_key" ON "brief_generation"("brief_id");

-- CreateIndex
CREATE INDEX "brief_generation_created_by_id_started_at_idx" ON "brief_generation"("created_by_id", "started_at");

-- AddForeignKey
ALTER TABLE "brief_generation" ADD CONSTRAINT "brief_generation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_generation" ADD CONSTRAINT "brief_generation_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
