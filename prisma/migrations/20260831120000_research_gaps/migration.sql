-- Staff-authored evidence-gap priorities. These records contain operational
-- metadata only; they are not evidence content and never enter the AI layer.
CREATE TYPE "research_gap_status" AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');
CREATE TYPE "research_gap_priority" AS ENUM ('urgent', 'high', 'medium', 'low');

CREATE TABLE "research_gap" (
  "id" TEXT NOT NULL,
  "signal_id" TEXT,
  "quarterly_narrative_id" TEXT,
  "impact_area" "impact_area" NOT NULL,
  "topic" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" "research_gap_priority" NOT NULL DEFAULT 'medium',
  "status" "research_gap_status" NOT NULL DEFAULT 'open',
  "logged_by_id" TEXT NOT NULL,
  "resolved_by_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolution_notes" TEXT,
  "resolved_evidence_item_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "research_gap_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "research_gap" ADD CONSTRAINT "research_gap_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "policy_signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_gap" ADD CONSTRAINT "research_gap_quarterly_narrative_id_fkey" FOREIGN KEY ("quarterly_narrative_id") REFERENCES "quarterly_evidence_narrative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_gap" ADD CONSTRAINT "research_gap_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "research_gap" ADD CONSTRAINT "research_gap_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "staff_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_gap" ADD CONSTRAINT "research_gap_resolved_evidence_item_id_fkey" FOREIGN KEY ("resolved_evidence_item_id") REFERENCES "evidence_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "research_gap_status_idx" ON "research_gap"("status");
CREATE INDEX "research_gap_impact_area_idx" ON "research_gap"("impact_area");
CREATE INDEX "research_gap_priority_idx" ON "research_gap"("priority");
CREATE INDEX "research_gap_signal_id_idx" ON "research_gap"("signal_id");
CREATE INDEX "research_gap_quarterly_narrative_id_idx" ON "research_gap"("quarterly_narrative_id");
