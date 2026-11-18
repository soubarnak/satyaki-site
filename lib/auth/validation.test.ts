import { describe, expect, it } from "vitest";
import {
  validateConsent,
  validateParentEmail,
  validatePassword,
  validateUsername,
} from "./validation";

describe("validateUsername (spec §7)", () => {
  it("accepts a normal username", () => {
    expect(validateUsername("Cadet_42")).toEqual({ ok: true });
  });
  it("rejects short, long, leading-digit, and spaced names", () => {
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("a".repeat(17)).ok).toBe(false);
    expect(validateUsername("1cadet").ok).toBe(false);
    expect(validateUsername("my name").ok).toBe(false);
  });
  it("rejects email-like and blocklisted names", () => {
    expect(validateUsername("admin").ok).toBe(false);
    expect(validateUsername("ADMIN").ok).toBe(false);
    expect(validateUsername("bongbetic").ok).toBe(false);
  });
});

describe("validatePassword (spec §7)", () => {
  it("accepts any 8-64 char password without classes", () => {
    expect(validatePassword("correct horse?", {}).ok).toBe(true);
    expect(validatePassword("********", {}).ok).toBe(true);
  });
  it("rejects short/long, common, or containing username/email part", () => {
    expect(validatePassword("short", {}).ok).toBe(false);
    expect(validatePassword("password", {}).ok).toBe(false);
    expect(validatePassword("Cadet_42 wins!", { username: "cadet_42" }).ok).toBe(false);
    expect(validatePassword("parent.example rocks", { email: "Parent@Example.com" }).ok).toBe(
      false,
    );
  });
});

describe("validateParentEmail + consent (spec §7)", () => {
  it("accepts a parent email and requires the checkbox", () => {
    expect(validateParentEmail("parent@example.com").ok).toBe(true);
    expect(validateParentEmail("not-an-email").ok).toBe(false);
    expect(validateConsent(true).ok).toBe(true);
    expect(validateConsent(false).ok).toBe(false);
  });
});
