-- Authored by scripts/new-migration.mjs from the live database diff.
-- REVIEW BEFORE APPLYING. If this migration adds a vector column, add its
-- HNSW cosine index here by hand — Prisma cannot generate one.

-- CreateTable
CREATE TABLE "google_drive_grant" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "refresh_token_sealed" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_drive_grant_staff_user_id_key" ON "google_drive_grant"("staff_user_id");

-- AddForeignKey
ALTER TABLE "google_drive_grant" ADD CONSTRAINT "google_drive_grant_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
