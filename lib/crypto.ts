/**
 * lib/crypto.ts
 *
 * AES-256-GCM symmetric encryption for API keys at rest.
 * Uses Node's built-in crypto module — no extra dependencies.
 *
 * The ENCRYPTION_SECRET env var must be exactly 64 hex characters (32 bytes).
 * Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET env var is not set. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (secret.length !== 64) {
    throw new Error(
      `ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes), got ${secret.length}`
    );
  }
  return Buffer.from(secret, "hex");
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a string previously produced by encryptApiKey().
 * Throws if the format is invalid, the auth tag doesn't match, or
 * ENCRYPTION_SECRET has changed since the key was saved.
 */
export function decryptApiKey(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format — expected iv:authTag:ciphertext");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "Decryption failed — the key may be corrupt or ENCRYPTION_SECRET has changed"
    );
  }
}
