// Password hashing (build choice per spec §7; algorithm not decided).
// scrypt from node:crypto: memory-hard, stdlib-only, no extra dep.
// Stored form: `scrypt$v1$n=...$r=...$p=...$saltHex$hashHex`.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

export function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString("hex");
  return `scrypt$v1$n=${SCRYPT_N}$r=${SCRYPT_R}$p=${SCRYPT_P}$${salt}$${hash}`;
}

function parseHash(stored: string): { salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return null;
  try {
    return {
      salt: Buffer.from(parts[5], "hex"),
      hash: Buffer.from(parts[6], "hex"),
    };
  } catch {
    return null;
  }
}

/** Constant-time compare; false on malformed stored hashes. */
export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const check = scryptSync(password, parsed.salt, parsed.hash.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (check.length !== parsed.hash.length) return false;
  return timingSafeEqual(check, parsed.hash);
}

/** SHA-256 hex helper for IPs and session tokens (raw values never stored). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
