// Account identity validation (spec §7, issue #35).
// Pure core: no framework, DOM, or Node imports. Glossary: Account.
// No real name or date of birth is collected or stored, ever.

/** Username: 4-16 chars, letters/numbers/underscore, starts with a letter. */
export const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,15}$/;
export const USERNAME_MIN = 4;
export const USERNAME_MAX = 16;

/** Password: 8-64 chars, any characters, no class rules (spec §7). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

/**
 * Blocklist for usernames (spec §7: profanity + reserved, e.g. admin,
 * brand names). Build list; extend without changing the interface.
 * Compared case-insensitively against the lowercased username.
 */
export const USERNAME_BLOCKLIST: readonly string[] = [
  "admin",
  "administrator",
  "root",
  "support",
  "moderator",
  "satayaki",
  "satyaki",
  "bongbetic",
  "spacecoder",
  "space_coder",
  "arena",
  "playground",
  "cadet",
  "guest",
  "null",
  "undefined",
];

/** Small common-password deny list (spec §7: rejected if common). */
export const COMMON_PASSWORDS: readonly string[] = [
  "password",
  "password1",
  "password123",
  "12345678",
  "qwerty123",
  "letmein123",
  "changeme123",
  "satyaki123",
];

/** Lowercase for case-insensitive uniqueness (spec §7). */
export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

/** Trimmed + lowercased parent/guardian email. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Local part (before @) of an email, lowercased; empty when malformed. */
export function emailNamePart(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "";
  return email.slice(0, at).toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Username rules: shape, email-like rejection, blocklist (spec §7). */
export function validateUsername(username: string): ValidationResult {
  if (!USERNAME_PATTERN.test(username)) {
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return {
        ok: false,
        reason: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters.`,
      };
    }
    return {
      ok: false,
      reason:
        "Username must start with a letter and use only letters, numbers, and underscore.",
    };
  }
  if (username.includes("@")) {
    return { ok: false, reason: "Username cannot be an email address." };
  }
  if (USERNAME_BLOCKLIST.includes(username.toLowerCase())) {
    return { ok: false, reason: "That username is reserved." };
  }
  return { ok: true };
}

/**
 * Password rules (spec §7): length only, plus rejection when common or
 * containing the username or the email name part (case-insensitive).
 * The name-part check applies when the part is at least 3 chars so
 * short prefixes like "a@" do not reject every password with an "a".
 */
export function validatePassword(
  password: string,
  opts: { username?: string; email?: string } = {},
): ValidationResult {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return {
      ok: false,
      reason: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`,
    };
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lower)) {
    return { ok: false, reason: "That password is too common." };
  }
  const username = opts.username?.toLowerCase() ?? "";
  if (username.length >= 3 && lower.includes(username)) {
    return { ok: false, reason: "Password cannot contain your username." };
  }
  const namePart = opts.email ? emailNamePart(opts.email.toLowerCase()) : "";
  if (namePart.length >= 3 && lower.includes(namePart)) {
    return { ok: false, reason: "Password cannot contain your email name." };
  }
  return { ok: true };
}

/** Parent/guardian email shape check. This inbox gets OTPs and resets only. */
export function validateParentEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return { ok: false, reason: "Enter a valid parent or guardian email." };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, reason: "Enter a valid parent or guardian email." };
  }
  return { ok: true };
}

/** The one required age/parent-permission checkbox (spec §7). */
export function validateConsent(consent: unknown): ValidationResult {
  if (consent !== true) {
    return {
      ok: false,
      reason: "Confirm you are a Cadet aged 10-13 with parent permission.",
    };
  }
  return { ok: true };
}
