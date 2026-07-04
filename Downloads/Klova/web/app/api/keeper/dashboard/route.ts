import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { getWalletSummary } from "@/app/api/keeper/_wallet";
import { createAdminClient } from "@/lib/supabase/admin";

function lagosTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Home-screen summary for a single keeper: next upcoming job, today's jobs,
// and current available wallet balance. Everything is scoped to the caller's
// own cleaner_id via requireKeeperAuth — never a client-supplied id.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const today = lagosTodayISO();

  // ── Upcoming/today jobs — confirmed bookings assigned to this keeper ────
  const { data: jobRows, error: jobsErr } = await admin
    .from("booking_cleaners")
    .select(`
      booking:bookings!inner(
        id, booking_date, time_slot, address, bedrooms, status,
        service:services(name)
      )
    `)
    .eq("cleaner_id", auth.cleanerId)
    .eq("booking.status", "confirmed")
    .order("booking_date", { referencedTable: "bookings", ascending: true })
    .order("time_slot", { referencedTable: "bookings", ascending: true, nullsFirst: false })
    .limit(20);

  if (jobsErr) return Response.json({ error: "Database error" }, { status: 500 });

  type JobRow = {
    id: string; booking_date: string; time_slot: string | null;
    address: string; bedrooms: string;
    service: { name: string } | null;
  };

  const jobs: JobRow[] = (jobRows ?? [])
    .map((r) => r.booking as unknown as JobRow)
    .filter(Boolean);

  const todayJobs = jobs.filter((j) => j.booking_date === today);
  const nextJob = jobs[0] ?? null;

  const shape = (j: JobRow) => ({
    booking_id: j.id,
    booking_date: j.booking_date,
    time_slot: j.time_slot,
    address: j.address,
    bedrooms: j.bedrooms,
    service_name: j.service?.name ?? "Cleaning",
  });

  // ── Wallet: available balance (owed earnings + transport − withdrawals) ──
  let availableKobo: number;
  try {
    availableKobo = (await getWalletSummary(admin, auth.cleanerId)).available_kobo;
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  return Response.json({
    next_job: nextJob ? shape(nextJob) : null,
    today_jobs: todayJobs.map(shape),
    wallet: { available_kobo: availableKobo },
  });
}
