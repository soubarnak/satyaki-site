"use client";

import { useState } from "react";

export default function VerifyPage() {
  const [status, setStatus] = useState("");
  async function onSubmit(form: FormData) {
    setStatus("Verifying…");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), code: form.get("code") }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setStatus(res.ok ? "Verified. You can log in." : (body.error ?? "Failed."));
  }
  return (
    <main>
      <h1>Verify</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
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
        <button type="submit">Verify</button>
      </form>
      <p>{status}</p>
    </main>
  );
}
