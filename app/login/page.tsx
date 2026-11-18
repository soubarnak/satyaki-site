"use client";

import { useState } from "react";
import { loginWithLocalProgress } from "@/lib/auth-progress-client";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";

export default function LoginPage() {
  const [status, setStatus] = useState("");
  async function onSubmit(form: FormData) {
    setStatus("Signing in…");
    const storage = browserProgressV2Storage();
    try {
      const out = await loginWithLocalProgress(fetch, storage.load(), {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
        sharedComputer: form.get("shared") === "on",
      });
      storage.save(out.progress);
      setStatus(out.replaced ? "Signed in. This device was reset to your Account." : "Signed in.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed.");
    }
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
