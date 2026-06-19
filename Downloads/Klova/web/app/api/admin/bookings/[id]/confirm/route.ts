import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminSms } from "@/lib/termii";

const CONFIRMABLE = ["matched", "paid", "confirmed"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select(`
      id, status, booking_date, address,
      customer:customers(first_name, last_name, phone),
      cleaner:cleaners(first_name),
      service:services(name)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!CONFIRMABLE.includes(booking.status as string)) {
    return Response.json(
      { error: `Cannot confirm a booking with status '${booking.status}'` },
      { status: 422 },
    );
  }

  // Flip to confirmed if not already there
  if (booking.status !== "confirmed") {
    const { error: updateErr } = await admin
      .from("bookings")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      return Response.json({ error: "Failed to update status" }, { status: 500 });
    }
  }

  // Send customer dispatch SMS (best-effort — never blocks the action)
  const customer = booking.customer as unknown as {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  const cleaner = booking.cleaner as unknown as { first_name: string } | null;
  const service = booking.service as unknown as { name: string } | null;

  let smsSent = false;
  if (customer && cleaner && service) {
    const date = new Date((booking.booking_date as string) + "T00:00:00").toLocaleDateString(
      "en-NG",
      { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" },
    );
    const message =
      `Hi ${customer.first_name}! Your Klova booking is confirmed. ` +
      `${cleaner.first_name} will be with you on ${date} for your ${service.name}. ` +
      `Questions? WhatsApp us on +234 800 000 0000.`;

    smsSent = await sendAdminSms(customer.phone, message);
  }

  return Response.json({ success: true, smsSent });
}
