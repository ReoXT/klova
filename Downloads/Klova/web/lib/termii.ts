function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length >= 13) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "234" + digits.slice(1);
  throw new Error(`Cannot normalise phone: "${raw}"`);
}

export async function sendAdminSms(to: string, message: string): Promise<boolean> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID ?? "Klova";

  if (!apiKey) {
    console.warn("[admin/sms] TERMII_API_KEY not set — SMS skipped");
    return false;
  }

  try {
    const res = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: normalizePhone(to),
        from: senderId,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });
    if (!res.ok) {
      console.error(`[admin/sms] Termii ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[admin/sms] Termii fetch error:", err);
    return false;
  }
}
