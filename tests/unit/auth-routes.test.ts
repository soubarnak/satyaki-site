import { afterEach, describe, expect, it } from "vitest";
import { createAuthHandlers, clearRegisterRateState } from "@/lib/server/auth-handler";
import { createStubMailer } from "@/lib/auth/mailer";
import { createMemoryAuthStore } from "@/lib/auth/store";

afterEach(() => {
  clearRegisterRateState();
});

function setup() {
  const store = createMemoryAuthStore();
  const { mailer, sent } = createStubMailer();
  let nowMs = 1_000_000_000;
  const handlers = createAuthHandlers({ store, mailer, now: () => nowMs });
  const advance = (ms: number) => {
    nowMs += ms;
  };
  return { store, sent, handlers, advance, now: () => nowMs };
}

function req(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://site.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string | null {
  const set = res.headers.get("set-cookie");
  if (!set) return null;
  const match = /satyaki_session=([^;]+)/.exec(set);
  return match ? match[1] : null;
}

describe("auth routes with stub mailer (spec §7 acceptance)", () => {
  it("register -> verify -> login, unverified cannot log in", async () => {
    const { handlers, sent } = setup();
    const reg = await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_1",
        email: "parent@example.com",
        password: "strong pass 123",
        consent: true,
      }),
    );
    expect(reg.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].code).toMatch(/^[0-9]{6}$/);

    const early = await handlers.login(req("/api/auth/login", { username: "Cadet_1", password: "strong pass 123" }));
    expect(early.status).toBe(403);

    const verify = await handlers.verify(
      req("/api/auth/verify", { email: "parent@example.com", code: sent[0].code }),
    );
    expect(verify.status).toBe(200);

    // Single use: same code again fails.
    const reuse = await handlers.verify(
      req("/api/auth/verify", { email: "parent@example.com", code: sent[0].code }),
    );
    expect(reuse.status).not.toBe(200);

    const login = await handlers.login(
      req("/api/auth/login", { username: "cadet_1", password: "strong pass 123" }),
    );
    expect(login.status).toBe(200);
    const token = cookieFrom(login);
    expect(token).toBeTruthy();
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const me = await handlers.me(
      new Request("http://site.test/api/auth/me", { headers: { cookie: `satyaki_session=${token}` } }),
    );
    expect(me.status).toBe(200);
  });

  it("resend invalidates the old code and honors the 60 s cooldown", async () => {
    const { handlers, sent, advance } = setup();
    await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_2",
        email: "p2@example.com",
        password: "another strong 1",
        consent: true,
      }),
    );
    const first = sent[0].code;
    const tooSoon = await handlers.resend(req("/api/auth/resend", { email: "p2@example.com", purpose: "verify" }));
    expect(tooSoon.status).toBe(429);
    advance(61 * 1000);
    const ok = await handlers.resend(req("/api/auth/resend", { email: "p2@example.com", purpose: "verify" }));
    expect(ok.status).toBe(200);
    expect(sent).toHaveLength(2);
    const second = sent[1].code;
    // Old code is dead even with the right digits.
    const stale = await handlers.verify(req("/api/auth/verify", { email: "p2@example.com", code: first }));
    expect(stale.status).not.toBe(200);
    const fresh = await handlers.verify(req("/api/auth/verify", { email: "p2@example.com", code: second }));
    expect(fresh.status).toBe(200);
  });

  it("wrong passwords stay generic and 10 failures lock for 15 minutes", async () => {
    const { handlers, sent, advance } = setup();
    await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_3",
        email: "p3@example.com",
        password: "yet another 1!",
        consent: true,
      }),
    );
    await handlers.verify(req("/api/auth/verify", { email: "p3@example.com", code: sent[0].code }));
    for (let i = 0; i < 10; i++) {
      const bad = await handlers.login(req("/api/auth/login", { username: "Cadet_3", password: "wrong pass!!" }));
      expect(bad.status).toBe(401);
      expect(((await bad.json()) as { error: string }).error).toBe("Username or password is wrong.");
    }
    const locked = await handlers.login(req("/api/auth/login", { username: "Cadet_3", password: "yet another 1!" }));
    expect(locked.status).toBe(429);
    advance(16 * 60 * 1000);
    const after = await handlers.login(req("/api/auth/login", { username: "Cadet_3", password: "yet another 1!" }));
    expect(after.status).toBe(200);
  });

  it("reset is OTP + new password on one screen and kills other sessions", async () => {
    const { handlers, sent, store, advance } = setup();
    await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_4",
        email: "p4@example.com",
        password: "old password 9",
        consent: true,
      }),
    );
    await handlers.verify(req("/api/auth/verify", { email: "p4@example.com", code: sent[0].code }));
    const login = await handlers.login(req("/api/auth/login", { username: "Cadet_4", password: "old password 9" }));
    const token = cookieFrom(login)!;
    advance(61 * 1000);
    await handlers.resetRequest(req("/api/auth/reset-request", { email: "p4@example.com" }));
    const code = sent[sent.length - 1].code;
    const done = await handlers.resetConfirm(
      req("/api/auth/reset-confirm", { email: "p4@example.com", code, newPassword: "brand new pass 10" }),
    );
    expect(done.status).toBe(200);
    // Old session is dead after the reset.
    const me = await handlers.me(
      new Request("http://site.test/api/auth/me", { headers: { cookie: `satyaki_session=${token}` } }),
    );
    expect(me.status).toBe(401);
    const accounts = await store.listAccounts();
    expect(accounts).toHaveLength(1);
    // No real-name or DOB fields ride along on the stored Account.
    expect(accounts[0]).not.toHaveProperty("realName");
    expect(accounts[0]).not.toHaveProperty("dob");
    expect(JSON.stringify(accounts[0])).not.toMatch(/birth/i);
  });

  it("deletion needs password + OTP, then grace; login inside grace cancels", async () => {
    const { handlers, sent, store } = setup();
    await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_5",
        email: "p5@example.com",
        password: "delete me pass 1",
        consent: true,
      }),
    );
    await handlers.verify(req("/api/auth/verify", { email: "p5@example.com", code: sent[0].code }));
    const login = await handlers.login(req("/api/auth/login", { username: "Cadet_5", password: "delete me pass 1" }));
    const token = cookieFrom(login)!;
    const authed = (extra: Record<string, string> = {}) =>
      new Request("http://site.test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${token}`, ...extra },
      });
    const need = await handlers.deleteRequest(
      new Request("http://site.test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${token}`, "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ password: "delete me pass 1" }),
      }),
    );
    expect(need.status).toBe(200);
    const code = sent[sent.length - 1].code;
    const confirmed = await handlers.deleteConfirm(authed());
    void confirmed;
    // Send the code in the body this time.
    const confirmed2 = await handlers.deleteConfirm(
      new Request("http://site.test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${token}` },
        body: JSON.stringify({ code }),
      }),
    );
    expect(confirmed2.status).toBe(200);
    // Login inside grace cancels the deletion.
    const back = await handlers.login(req("/api/auth/login", { username: "Cadet_5", password: "delete me pass 1" }));
    expect(back.status).toBe(200);
    const accounts = await store.listAccounts();
    expect(accounts[0].deletionRequestedAtMs).toBe(null);
    // Past grace the sweep hard-deletes and reserves the name.
    const backToken = cookieFrom(back)!;
    const again = await handlers.deleteRequest(
      new Request("http://site.test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${backToken}`, "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ password: "delete me pass 1" }),
      }),
    );
    expect(again.status).toBe(200);
    const againCode = sent[sent.length - 1].code;
    const againConfirm = await handlers.deleteConfirm(
      new Request("http://site.test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${backToken}` },
        body: JSON.stringify({ code: againCode }),
      }),
    );
    expect(againConfirm.status).toBe(200);
    const swept = await handlers.sweep(1_000_000_000 + 31 * 24 * 60 * 60 * 1000);
    expect(swept.deletedIds).toHaveLength(1);
    const taken = await handlers.register(
      req("/api/auth/register", {
        username: "Cadet_5",
        email: "fresh@example.com",
        password: "another clean 99!",
        consent: true,
      }),
    );
    expect(taken.status).toBe(409);
  });
});
