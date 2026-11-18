// sendOtpEmail() seam (spec §7, issue #32). Single server seam behind
// which Resend (free tier, 100/day cap) sends over HTTPS from an
// SPF/DKIM/DMARC-verified subdomain. SES/Brevo migrate behind the same
// seam. No test calls the live provider: route tests inject the stub.

import type { OtpPurpose } from "./otp";

export interface OtpMailer {
  sendOtpEmail(to: string, code: string, purpose: OtpPurpose): Promise<void>;
  sendUsernameEmail?(to: string, username: string): Promise<void>;
}

function purposeSubject(purpose: OtpPurpose): string {
  switch (purpose) {
    case "verify":
      return "Your Satyaki Space Coder code";
    case "reset":
      return "Reset your Satyaki Space Coder password";
    case "delete":
      return "Confirm Satyaki Space Coder deletion";
    case "email-change":
      return "Confirm your new email";
  }
}

/** In-memory stub for route integration tests: records every send. */
export function createStubMailer() {
  const sent: { to: string; code: string; purpose: OtpPurpose; username?: string }[] = [];
  const mailer: OtpMailer = {
    async sendOtpEmail(to, code, purpose) {
      sent.push({ to, code, purpose });
    },
    async sendUsernameEmail(to, username) {
      sent.push({ to, code: "", purpose: "verify", username });
    },
  };
  return { mailer, sent };
}

export interface ResendConfig {
  apiKey: string;
  /** Verified subdomain sender, e.g. `Satyaki <login@mail.example.com>`. */
  from: string;
}

type FetchFn = typeof fetch;

/** Resend HTTPS mailer behind the sendOtpEmail() seam. */
export function createResendMailer(config: ResendConfig, fetchFn: FetchFn = fetch): OtpMailer {
  return {
    async sendOtpEmail(to, code, purpose) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          subject: purposeSubject(purpose),
          text: `Your code is ${code}. It expires in 10 minutes and can be used once.`,
        }),
      });
      if (!res.ok) throw new Error("otp send failed");
    },
    async sendUsernameEmail(to, username) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          subject: "Your Satyaki Space Coder username",
          text: `Your username is ${username}.`,
        }),
      });
      if (!res.ok) throw new Error("username send failed");
    },
  };
}

/**
 * Read the mailer env. Null apiKey means no mailer is configured and auth
 * routes fail closed with a 503 instead of creating unverifiable Accounts.
 */
export function readMailerEnv(
  env: Record<string, string | undefined> = process.env,
): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.OTP_MAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}
