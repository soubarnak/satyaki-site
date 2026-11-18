import { describe, expect, it } from "vitest";
import {
  cancelDeletionOnLogin,
  isGraceExpired,
  isUnverifiedExpired,
  isUsernameReserved,
  pruneReserved,
  requestDeletion,
  sweepAccounts,
} from "./deletion";
import { GUEST_OWNER } from "../progress";

void GUEST_OWNER;

describe("deletion grace, auto-delete, reservations (spec §7)", () => {
  it("login inside grace cancels deletion; past 30 days it is expired", () => {
    const t0 = 1_000_000;
    const requested = requestDeletion(
      { id: "a", usernameLower: "cadet1", emailVerified: true, createdAtMs: t0, deletionRequestedAtMs: null },
      t0,
    );
    expect(requested.deletionRequestedAtMs).toBe(t0);
    expect(isGraceExpired(requested, t0 + 29 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isGraceExpired(requested, t0 + 30 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(cancelDeletionOnLogin(requested).deletionRequestedAtMs).toBe(null);
  });

  it("unverified Accounts auto-delete after 7 days", () => {
    const t0 = 2_000_000;
    const young = {
      id: "u", usernameLower: "cadet2", emailVerified: false, createdAtMs: t0, deletionRequestedAtMs: null,
    };
    expect(isUnverifiedExpired(young, t0 + 6 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isUnverifiedExpired(young, t0 + 7 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("sweep hard-deletes grace/unverified and reserves names for 90 days", () => {
    const t0 = 10_000_000;
    const day = 24 * 60 * 60 * 1000;
    const grace = {
      id: "g", usernameLower: "gone1", emailVerified: true, createdAtMs: t0 - 60 * day, deletionRequestedAtMs: t0 - 31 * day,
    };
    const unverified = {
      id: "u", usernameLower: "gone2", emailVerified: false, createdAtMs: t0 - 8 * day, deletionRequestedAtMs: null,
    };
    const kept = {
      id: "k", usernameLower: "stays", emailVerified: true, createdAtMs: t0 - day, deletionRequestedAtMs: null,
    };
    const result = sweepAccounts({ accounts: [grace, unverified, kept], reserved: [], nowMs: t0 });
    expect(result.deleted.map((a) => a.id).sort()).toEqual(["g", "u"]);
    expect(result.kept.map((a) => a.id)).toEqual(["k"]);
    expect(isUsernameReserved(result.reserved, "gone1", t0)).toBe(true);
    expect(isUsernameReserved(result.reserved, "gone2", t0)).toBe(true);
    expect(isUsernameReserved(result.reserved, "gone1", t0 + 90 * day + 1)).toBe(false);
    expect(pruneReserved(result.reserved, t0 + 91 * day)).toEqual([]);
  });
});
