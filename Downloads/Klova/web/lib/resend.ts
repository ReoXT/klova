import { Resend } from "resend";
import type { ReactElement } from "react";

// From address for transactional emails (withdrawal receipts, PIN changes,
// etc). Uses whatever domain is already verified in Resend for the Supabase
// SMTP setup, since it's the same Resend account/domain, just a different
// credential (an API key here vs. the SMTP password Supabase uses).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Klova <onboarding@resend.dev>";

let client: Resend | null = null;

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  client ??= new Resend(key);
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// Thin wrapper around Resend's send call, given a React Email component
// (from web/emails/) as the body. Never throws: callers get back
// { ok: false, error } instead, since a failed notification email should
// never break the request that triggered it.
export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<SendEmailResult> {
  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    });

    if (error) {
      console.error(`[resend] Send failed to ${to}: ${error.message}`);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] Send threw for ${to}: ${message}`);
    return { ok: false, error: message };
  }
}
