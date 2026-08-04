import "server-only";

import { prisma } from "./client";

/**
 * The Google Drive grant's reads and writes.
 *
 * IN THE DATA LAYER LIKE EVERYTHING ELSE THAT TOUCHES PRISMA (AGENTS.md §5.2).
 * The Drive client knows how to mint a token; it does not know where the sealed
 * one is kept, and the OAuth routes do not construct queries.
 *
 * NOTHING HERE SEALS OR OPENS ANYTHING. This module moves an opaque string in
 * and out of a row. `lib/crypto/secret-box.ts` does the cryptography and
 * `lib/google/drive-client.ts` holds the key — so a reader of this file learns
 * where the ciphertext lives and nothing about how to read it.
 */

export type GoogleDriveGrantRecord = {
  id: string;
  /** AES-256-GCM ciphertext. Opaque here, and never logged anywhere. */
  refreshTokenSealed: string;
  scope: string;
};

/** The grant for one staff member, or null when they have not authorised Drive. */
export async function findGoogleDriveGrant(
  staffUserId: string,
): Promise<GoogleDriveGrantRecord | null> {
  return prisma.googleDriveGrant.findUnique({
    where: { staffUserId },
    select: { id: true, refreshTokenSealed: true, scope: true },
  });
}

export type SaveGoogleDriveGrantInput = {
  staffUserId: string;
  refreshTokenSealed: string;
  scope: string;
};

/**
 * The grant, written or replaced.
 *
 * AN UPSERT RATHER THAN A CREATE, because re-consenting is an ordinary thing to
 * do — after a revocation at Google, or after the scope set changes — and the
 * second grant must replace the first rather than collide with the unique
 * constraint. `grantedAt` deliberately keeps its original value on update; it
 * records when this staff member first authorised Drive, and `updatedAt` is
 * what moves.
 */
export async function saveGoogleDriveGrant(
  input: SaveGoogleDriveGrantInput,
): Promise<void> {
  await prisma.googleDriveGrant.upsert({
    where: { staffUserId: input.staffUserId },
    create: {
      staffUserId: input.staffUserId,
      refreshTokenSealed: input.refreshTokenSealed,
      scope: input.scope,
    },
    update: {
      refreshTokenSealed: input.refreshTokenSealed,
      scope: input.scope,
    },
  });
}

/**
 * Revocation, and the cleanup after Google has told us a grant is dead.
 *
 * DELETING THE ROW IS THE REVOCATION — there is no `revoked` column, because a
 * revoked grant has no use and keeping the ciphertext of a dead credential
 * would be storage of a secret for nothing.
 *
 * `deleteMany` rather than `delete` so that deleting a grant that is already
 * gone is a no-op rather than a thrown error: the caller is on a failure path
 * already, and two exports racing after a revocation must not turn into a 500.
 */
export async function deleteGoogleDriveGrant(
  staffUserId: string,
): Promise<void> {
  await prisma.googleDriveGrant.deleteMany({ where: { staffUserId } });
}
