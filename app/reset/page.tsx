"use client";

import { useState } from "react";

// Password reset: OTP + new password on one screen, no emailed links.
export default function ResetPage() {
  const [status, setStatus] = useState("");
  async function request(form: FormData) {
    setStatus("Sending code…");
    const res = await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setStatus(res.ok ? "If the email is registered, a code is on its way." : "Failed.");
  }
  async function confirm(form: FormData) {
    setStatus("Resetting…");
    const res = await fetch("/api/auth/reset-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        code: form.get("code"),
        newPassword: form.get("newPassword"),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setStatus(res.ok ? "Password reset. Log in with the new password." : (body.error ?? "Failed."));
  }
  return (
    <main>
      <h1>Reset</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void request(new FormData(e.currentTarget));
        }}
      >
        <label>
          Parent or guardian email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <button type="submit">Send code</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm(new FormData(e.currentTarget));
        }}
      >
        <label>
          Parent or guardian email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          6-digit code
          <input name="code" required inputMode="numeric" pattern="[0-9]{6}" />
        </label>
        <label>
          New password
          <input name="newPassword" type="password" required minLength={8} maxLength={64} autoComplete="new-password" />
        </label>
        <button type="submit">Reset password</button>
      </form>
      <p>{status}</p>
    </main>
  );
}
