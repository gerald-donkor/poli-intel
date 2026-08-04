import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for a secret this application has to keep at rest.
 *
 * ITS ONE CALLER TODAY is the stored Google Drive refresh token
 * (`lib/google/drive-client.ts`), which is a long-lived credential against a
 * staff member's own Workspace account. A row in Supabase holding it in the
 * clear would be a credential readable by anyone who can read the database.
 *
 * PURE, AND IT READS NO ENVIRONMENT. The key is passed in, which is what keeps
 * key handling in one place — the Drive client — rather than scattered across
 * cipher call sites, and what makes this module testable without a deployment.
 * It is deliberately not `server-only`: there is no secret in this file. The
 * modules that hold a key are the ones marked server-only.
 *
 * AES-256-GCM, so a tampered ciphertext fails to open rather than decrypting to
 * something. `open` returns null on any failure — wrong key, truncated value,
 * altered tag, garbage — because to a caller those are the same outcome: the
 * secret is not available, ask for it again.
 */

const ALGORITHM = "aes-256-gcm";

/** AES-256. Anything else is a misconfiguration, not a shorter key. */
const KEY_BYTES = 32;

/** GCM's standard nonce length; 96 bits is what the mode is specified for. */
const IV_BYTES = 12;

const TAG_BYTES = 16;

/**
 * Version prefix, so a future change of algorithm can be told apart from a
 * corrupt value instead of being guessed at.
 */
const PREFIX = "v1";

/**
 * A 32-byte key decoded from a base64 environment value, or null.
 *
 * NULL RATHER THAN A THROW, because "this deployment has no Drive export
 * configured" is an ordinary state — a local `npm run dev` with no Drive setup
 * must not crash (§17.6, the unconfigured state). A key of the wrong length is
 * the same outcome: refused, and the reason named without the value.
 */
export function decodeKey(value: string | undefined): Buffer | null {
  if (!value) return null;

  let key: Buffer;

  try {
    key = Buffer.from(value, "base64");
  } catch {
    return null;
  }

  return key.length === KEY_BYTES ? key : null;
}

/**
 * Seal a secret. Output is `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 *
 * The IV is fresh per call. Reusing one under the same key in GCM is a
 * catastrophic failure of the mode, so it is generated here and never passed
 * in.
 */
export function seal(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Open a sealed secret, or null.
 *
 * NEVER THROWS AND NEVER REPORTS WHY. A caller that could distinguish "wrong
 * tag" from "wrong length" would be an oracle, and there is nothing a caller
 * would do differently anyway: the answer is always to re-acquire the secret.
 */
export function open(sealed: string, key: Buffer): string | null {
  const parts = sealed.split(".");

  if (parts.length !== 4) return null;

  const [prefix, ivPart, tagPart, ciphertextPart] = parts;

  // Constant-time on the prefix is not a secrecy requirement — the prefix is a
  // constant — so a plain comparison is honest here.
  if (prefix !== PREFIX) return null;

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
