-- Authored by scripts/new-migration.mjs from the live database diff, then
-- hand-edited to add the backfill on `brief_version.audience` (see below).
-- No vector column is touched, so no HNSW index is added here.

-- AlterEnum
--
-- A verified draft the officer chose not to take up. Distinct from `failed`,
-- which means no draft was produced. Postgres allows ADD VALUE inside a
-- transaction as long as the value is not USED in the same transaction, and
-- nothing below uses it.
ALTER TYPE "generation_stage" ADD VALUE 'discarded';

-- DropIndex
--
-- `brief_generation.brief_id` stops being unique. The uniqueness was incidental
-- to there having been exactly one attempt per brief; a brief reframed twice has
-- three attempts, and each is a real record of a real generation.
DROP INDEX "brief_generation_brief_id_key";

-- AlterTable
--
-- The stage-3 fact-check verdicts, held on the attempt so the flags the officer
-- reviewed in the diff are the flags that land at commit.
ALTER TABLE "brief_generation" ADD COLUMN     "fact_check_json" JSONB;

-- AlterTable
--
-- THE BACKFILL. Prisma's diff proposes this column as NOT NULL in one statement,
-- which fails against any existing row. Added nullable, backfilled from the
-- brief's current audience — which is what every existing version was in fact
-- written for, since no audience switch has ever run — then made NOT NULL, so no
-- version is ever ambiguous about its reader (`brief-output` rule 5).
ALTER TABLE "brief_version" ADD COLUMN     "audience" "brief_audience";

UPDATE "brief_version" AS v
SET "audience" = b."audience"
FROM "brief" AS b
WHERE v."brief_id" = b."id";

ALTER TABLE "brief_version" ALTER COLUMN "audience" SET NOT NULL;

-- CreateIndex
CREATE INDEX "brief_generation_brief_id_idx" ON "brief_generation"("brief_id");
