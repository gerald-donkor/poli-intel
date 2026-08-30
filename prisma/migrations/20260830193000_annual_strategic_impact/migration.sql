-- Annual strategic evaluation fields. Nullable estimates mean "not recorded",
-- never a fabricated zero; partner codes are validated by the application.
ALTER TABLE "influence_event"
  ADD COLUMN "hectares_impacted" DOUBLE PRECISION,
  ADD COLUMN "people_impacted" INTEGER,
  ADD COLUMN "adapted_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "influence_event_verified_verified_at_idx"
  ON "influence_event"("verified", "verified_at");
