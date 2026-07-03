import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { projectKeeperEarningKobo, type BookingFinancials } from "@/app/api/keeper/_earnings";
import { deriveArea, timeSlotRank } from "@/app/api/keeper/_area";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = ["matched", "paid", "confirmed"];
const PAST_STATUSES = ["completed", "cancelled"];

function lagosTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

interface BookingRow extends BookingFinancials {
  id: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  bedrooms: string;
  status: string;
  keeper_count: number;
  service: { name: string } | null;
  zone: { name: string } | null;
}

export interface KeeperJobSummary {
  booking_id: string;
  status: string;
  booking_date: string;
  time_slot: string | null;
  service_name: string;
  bedrooms: string;
  area: string;
  earning_kobo: number;
  transport_fare_kobo: number | null;
  shared_with: string | null;
  role: "lead" | "second";
}

// All of the signed-in keeper's jobs — including two-keeper bookings where
// they're one of two — grouped into upcoming / today / past. Every query is
// scoped to auth.cleanerId (resolved from the session by requireKeeperAuth);
// nothing here ever accepts a client-supplied cleaner_id.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const today = lagosTodayISO();

  const { data: myRows, error: myErr } = await admin
    .from("booking_cleaners")
    .select(`
      role, transport_fare_kobo,
      booking:bookings!inner(
        id, booking_date, time_slot, address, bedrooms, status, keeper_count,
        base_amount_kobo, addons_amount_kobo, insurance_amount_kobo,
        commission_kobo, total_amount_kobo, refund_kobo,
        service:services(name), zone:zones(name)
      )
    `)
    .eq("cleaner_id", auth.cleanerId)
    .in("booking.status", [...ACTIVE_STATUSES, ...PAST_STATUSES]);

  if (myErr) return Response.json({ error: "Database error" }, { status: 500 });

  type MyRow = { role: string; transport_fare_kobo: number | null; booking: BookingRow };
  const rows = (myRows ?? []) as unknown as MyRow[];

  if (rows.length === 0) {
    return Response.json({ upcoming: [], today: [], past: [] });
  }

  const bookingIds = rows.map((r) => r.booking.id);

  // Companion keeper (if any) per booking, for the "shared with" indicator.
  const { data: companionRows, error: compErr } = await admin
    .from("booking_cleaners")
    .select("booking_id, cleaner_id, cleaner:cleaners(first_name)")
    .in("booking_id", bookingIds)
    .neq("cleaner_id", auth.cleanerId);

  if (compErr) return Response.json({ error: "Database error" }, { status: 500 });

  const companionByBooking = new Map<string, string>();
  for (const c of (companionRows ?? []) as unknown as {
    booking_id: string; cleaner: { first_name: string } | null;
  }[]) {
    if (c.cleaner?.first_name) companionByBooking.set(c.booking_id, c.cleaner.first_name);
  }

  // Actual recorded earnings for completed bookings (authoritative once they
  // exist — accounts for any refund adjustment already applied at record
  // time). Non-completed bookings fall back to the live projection below.
  const { data: earningRows, error: earnErr } = await admin
    .from("cleaner_earnings")
    .select("booking_id, earning_kobo")
    .eq("cleaner_id", auth.cleanerId)
    .in("booking_id", bookingIds);

  if (earnErr) return Response.json({ error: "Database error" }, { status: 500 });

  const earningByBooking = new Map<string, number>();
  for (const e of (earningRows ?? []) as { booking_id: string; earning_kobo: number }[]) {
    earningByBooking.set(e.booking_id, e.earning_kobo);
  }

  const upcoming: KeeperJobSummary[] = [];
  const todayList: KeeperJobSummary[] = [];
  const past: KeeperJobSummary[] = [];

  for (const row of rows) {
    const b = row.booking;
    const role = row.role === "lead" ? "lead" : "second";

    let earningKobo: number;
    if (b.status === "cancelled") {
      earningKobo = 0;
    } else if (b.status === "completed") {
      earningKobo = earningByBooking.get(b.id)
        ?? projectKeeperEarningKobo(b, b.keeper_count, role);
    } else {
      earningKobo = projectKeeperEarningKobo(b, b.keeper_count, role);
    }

    const summary: KeeperJobSummary = {
      booking_id: b.id,
      status: b.status,
      booking_date: b.booking_date,
      time_slot: b.time_slot,
      service_name: b.service?.name ?? "Cleaning",
      bedrooms: b.bedrooms,
      area: deriveArea(b.address, b.zone?.name ?? "Lekki / Ajah"),
      earning_kobo: earningKobo,
      transport_fare_kobo: row.transport_fare_kobo,
      shared_with: companionByBooking.get(b.id) ?? null,
      role,
    };

    if (PAST_STATUSES.includes(b.status)) {
      past.push(summary);
    } else if (b.booking_date === today) {
      todayList.push(summary);
    } else if (b.booking_date > today) {
      upcoming.push(summary);
    } else {
      // Defensive: an active-status booking dated before today (cron hasn't
      // flipped it to completed yet) reads as past rather than upcoming.
      past.push(summary);
    }
  }

  const byDateAsc = (a: KeeperJobSummary, b: KeeperJobSummary) =>
    a.booking_date === b.booking_date
      ? timeSlotRank(a.time_slot) - timeSlotRank(b.time_slot)
      : a.booking_date.localeCompare(b.booking_date);

  const byDateDesc = (a: KeeperJobSummary, b: KeeperJobSummary) =>
    a.booking_date === b.booking_date
      ? timeSlotRank(a.time_slot) - timeSlotRank(b.time_slot)
      : b.booking_date.localeCompare(a.booking_date);

  upcoming.sort(byDateAsc);
  todayList.sort(byDateAsc);
  past.sort(byDateDesc);

  return Response.json({ upcoming, today: todayList, past });
}
