"use client";

import { useState } from "react";

// Register: parent/guardian email + username + password + consent.
// Glossary: Account. No real name or date of birth fields, ever.
export default function RegisterPage() {
  const [status, setStatus] = useState("");
  async function onSubmit(form: FormData) {
    setStatus("Sending code…");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
        consent: form.get("consent") === "on",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setStatus(res.ok ? "Check the parent inbox for the code." : (body.error ?? "Failed."));
  }
  return (
    <main>
      <h1>Register</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        <label>
          Username
          <input name="username" required minLength={4} maxLength={16} autoComplete="username" />
        </label>
        <label>
          Parent or guardian email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} maxLength={64} autoComplete="new-password" />
        </label>
        <label>
          <input name="consent" type="checkbox" required />I am a Cadet aged 10–13 with parent permission, or a
          parent/guardian registering one.
        </label>
        <button type="submit">Register</button>
      </form>
      <p>{status}</p>
    </main>
  );
}
