import { sendKeeperEmail, type KeeperNotification } from "@/lib/keeperNotify";

// Lets api/'s Express backend (Railway) trigger a keeper email for the
// events it owns: new job assigned, withdrawal paid, withdrawal failed.
// Email templates and the send dispatcher (lib/keeperNotify.ts) live only
// in web/, so this is how the other backend reaches them rather than
// duplicating them. Gated by a shared secret, never by keeper session auth,
// since the caller here is our own trusted backend, not a browser.
export async function POST(request: Request) {
  const expected = process.env.INTERNAL_NOTIFY_SECRET;
  const provided = request.headers.get("x-internal-secret");

  if (!expected || !provided || provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; type?: string; data?: unknown }
    | null;

  if (!body?.email || !body.type || !body.data) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  await sendKeeperEmail(body.email, { type: body.type, data: body.data } as KeeperNotification);

  return Response.json({ ok: true });
}
