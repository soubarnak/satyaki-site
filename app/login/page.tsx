"use client";

import { useState } from "react";

export default function LoginPage() {
  const [status, setStatus] = useState("");
  async function onSubmit(form: FormData) {
    setStatus("Signing in…");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
        sharedComputer: form.get("shared") === "on",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setStatus(res.ok ? "Signed in." : (body.error ?? "Failed."));
  }
  return (
    <main>
      <h1>Login</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        <label>
          Username
          <input name="username" required autoComplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <label>
          <input name="shared" type="checkbox" />
          This is a shared computer
        </label>
        <button type="submit">Login</button>
      </form>
      <p>{status}</p>
    </main>
  );
}
