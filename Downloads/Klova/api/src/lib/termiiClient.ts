import { config } from '../config';

// ─── Phone normalisation ──────────────────────────────────────────────────────
// Termii expects E.164 without the leading +, e.g. 2348012345678.
// Accept: 0803..., +234803..., 234803... — all normalise to 234XXXXXXXXXX.

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);

  throw new Error(`Cannot normalise phone number: "${raw}"`);
}

// ─── Termii channel ───────────────────────────────────────────────────────────

type TermiiChannel = 'generic' | 'dnd' | 'whatsapp';

interface TermiiSendPayload {
  api_key: string;
  to: string;
  from: string;
  sms: string;
  type: 'plain';
  channel: TermiiChannel;
}

interface TermiiResponse {
  message?: string;
  code?: string;
  message_id?: string;
}

// ─── Core send function ───────────────────────────────────────────────────────

async function send(to: string, message: string, channel: TermiiChannel): Promise<void> {
  if (!config.termiiApiKey || !config.termiiSenderId) {
    console.warn('[termii] TERMII_API_KEY or TERMII_SENDER_ID not set — skipping send');
    return;
  }

  const normalised = normalizePhone(to);

  const payload: TermiiSendPayload = {
    api_key: config.termiiApiKey,
    to: normalised,
    from: config.termiiSenderId,
    sms: message,
    type: 'plain',
    channel,
  };

  const res = await fetch('https://v3.api.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as TermiiResponse;

  if (!res.ok) {
    throw new Error(
      `Termii ${channel} send failed [${res.status}]: ${body.message ?? JSON.stringify(body)}`,
    );
  }

  console.log(`[termii] ${channel} sent to ${normalised} — id: ${body.message_id ?? 'n/a'}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendSms(to: string, message: string): Promise<void> {
  await send(to, message, 'generic');
}

// WhatsApp requires an approved WhatsApp Business integration in the Termii dashboard.
// Once the integration is live, swap 'sendSms' calls to 'sendWhatsApp' where appropriate.
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  await send(to, message, 'whatsapp');
}
