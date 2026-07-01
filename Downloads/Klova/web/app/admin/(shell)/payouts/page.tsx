"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────── */
interface BookingRow {
  booking_id:                  string;
  booking_date:                string;
  time_slot:                   string | null;
  service_name:                string;
  total_amount_kobo:           number;
  commission_kobo:             number;
  clean_earnings_kobo:         number;
  transport_status:            string;
  transport_fare_ngn:          number | null;
  transport_reimbursement_ngn: number;
}

interface KeeperPayout {
  cleaner_id:          string;
  first_name:          string;
  last_name:           string;
  photo_url:           string | null;
  has_bank_account:    boolean;
  bank_name:           string | null;
  account_number:      string | null;
  account_name:        string | null;
  bookings:            BookingRow[];
  total_clean_kobo:    number;
  total_transport_ngn: number;
  total_payout_ngn:    number;
}

interface HistoryRow {
  id:                  string;
  cleaner_first_name:  string;
  cleaner_last_name:   string;
  total_kobo:          number;
  method:              string;
  status:              string;
  failure_reason:      string | null;
  initiated_at:        string | null;
  completed_at:        string | null;
  created_at:          string;
  bank_name:           string | null;
  account_number:      string | null;
}

/* ── Helpers ────────────────────────────────────────────────────── */
function ngnKobo(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function ngnAmt(ngn: number) {
  return "₦" + Math.round(ngn).toLocaleString("en-NG");
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  return (
    <div
      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
      style={{ background: "oklch(0.9 0.04 250)", color: "var(--color-primary)" }}
    >
      {initials || "?"}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  success:    "badge-success",
  processing: "badge-info",
  pending:    "badge-warning",
  failed:     "badge-error",
  reversed:   "badge-error",
};

/* ── Page ───────────────────────────────────────────────────────── */
export default function PayoutsPage() {
  const [keepers,      setKeepers]     = useState<KeeperPayout[]>([]);
  const [history,      setHistory]     = useState<HistoryRow[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState<string | null>(null);
  const [actionState, setActionState]  = useState<
    Record<string, { busy: boolean; msg: string | null; isError: boolean }>
  >({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/admin/payouts/bookings").then((r) => r.json()),
      fetch("/api/admin/payouts").then((r) => r.json()),
    ])
      .then(([salaryData, histData]) => {
        if (salaryData.error) throw new Error(salaryData.error as string);
        setKeepers(salaryData.keepers ?? []);
        setHistory(histData.history ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function setAction(cid: string, busy: boolean, msg: string | null, isError = false) {
    setActionState((s) => ({ ...s, [cid]: { busy, msg, isError } }));
  }

  async function handleMarkPaid(k: KeeperPayout) {
    const lines = [
      `Mark ${k.first_name} ${k.last_name} as paid out?`,
      "",
      `Cleaning fees:  ${ngnKobo(k.total_clean_kobo)}`,
      k.total_transport_ngn > 0 ? `Transport:      ${ngnAmt(k.total_transport_ngn)}` : null,
      `──────────────────────────────`,
      `Total:          ${ngnAmt(k.total_payout_ngn)}`,
      "",
      "Settle all unpaid earnings and transport fares. This cannot be undone.",
    ].filter(Boolean).join("\n");

    if (!window.confirm(lines)) return;

    setAction(k.cleaner_id, true, null);
    try {
      const r = await fetch(`/api/admin/payouts/bookings/${k.cleaner_id}/mark-paid`, { method: "POST" });
      const d = await r.json() as { booking_count: number; total_payout_ngn: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Request failed");
      setAction(
        k.cleaner_id,
        false,
        `Paid out — ${d.booking_count} job${d.booking_count !== 1 ? "s" : ""}, ${ngnAmt(d.total_payout_ngn)} total.`,
        false,
      );
      setTimeout(load, 600);
    } catch (err) {
      setAction(k.cleaner_id, false, err instanceof Error ? err.message : "Error", true);
    }
  }

  const grandTotal     = keepers.reduce((s, k) => s + k.total_payout_ngn, 0);
  const cleanTotal     = keepers.reduce((s, k) => s + Math.round(k.total_clean_kobo / 100), 0);
  const transportTotal = keepers.reduce((s, k) => s + k.total_transport_ngn, 0);
  const totalJobs      = keepers.reduce((s, k) => s + k.bookings.length, 0);

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
            Payouts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Keeper salary run — cleaning fees (78%) + transport reimbursements
          </p>
        </div>
        <button onClick={load} className="btn btn-soft btn-sm gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface-card)" }}>
          <p className="text-sm" style={{ color: "var(--color-error)" }}>{error}</p>
        </div>
      ) : (
        <>
          {/* ── Grand-total strip ──────────────────────────────── */}
          {keepers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Grand total",    value: ngnAmt(grandTotal),   primary: true  },
                { label: "Clean earnings", value: ngnAmt(cleanTotal),   primary: false },
                { label: "Transport",      value: ngnAmt(transportTotal), primary: false },
                { label: `${keepers.length} Keeper${keepers.length !== 1 ? "s" : ""} · ${totalJobs} job${totalJobs !== 1 ? "s" : ""}`,
                  value: "outstanding",    primary: false },
              ].map(({ label, value, primary }) => (
                <div
                  key={label}
                  className="rounded-2xl p-5"
                  style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </p>
                  <p
                    className="text-2xl font-bold tabular-nums mt-1"
                    style={{ color: primary ? "var(--color-primary)" : "var(--text-strong)" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Per-Keeper salary cards ────────────────────────── */}
          {keepers.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                All Keepers are paid up to date.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {keepers.map((k) => {
                const as = actionState[k.cleaner_id];
                return (
                  <div
                    key={k.cleaner_id}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
                  >
                    {/* ── Keeper identity header ──────────────── */}
                    <div
                      className="px-5 py-4 flex items-center gap-3 border-b"
                      style={{ borderColor: "var(--color-base-200)", background: "oklch(0.975 0.003 240)" }}
                    >
                      <Avatar url={k.photo_url} name={`${k.first_name} ${k.last_name}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
                          {k.first_name} {k.last_name}
                        </p>
                        {k.has_bank_account ? (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {k.bank_name} · {k.account_name} · {k.account_number}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-warning">No bank account on file</p>
                        )}
                      </div>
                      <p className="text-xl font-bold tabular-nums shrink-0" style={{ color: "var(--color-primary)" }}>
                        {ngnAmt(k.total_payout_ngn)}
                      </p>
                    </div>

                    {/* ── Per-booking breakdown ───────────────── */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: "oklch(0.97 0.003 240)" }}>
                            {["Date", "Service", "Job total", "Keeper (78%)", "Transport"].map((h) => (
                              <th
                                key={h}
                                className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
                          {k.bookings.map((b) => (
                            <tr key={b.booking_id} className="hover:bg-base-50 transition-colors">
                              <td className="px-5 py-3 tabular-nums text-xs whitespace-nowrap"
                                style={{ color: "var(--text-muted)" }}>
                                {fmtShort(b.booking_date)}
                              </td>
                              <td className="px-5 py-3" style={{ color: "var(--text-strong)" }}>
                                {b.service_name}
                              </td>
                              <td className="px-5 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                                {ngnKobo(b.total_amount_kobo)}
                              </td>
                              <td className="px-5 py-3 tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                                {ngnKobo(b.clean_earnings_kobo)}
                              </td>
                              <td className="px-5 py-3 tabular-nums">
                                {b.transport_reimbursement_ngn > 0 ? (
                                  <span className="font-medium" style={{ color: "oklch(0.45 0.12 145)" }}>
                                    {ngnAmt(b.transport_reimbursement_ngn)}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ── Salary-breakdown footer ─────────────── */}
                    <div
                      className="px-5 py-4 border-t"
                      style={{ borderColor: "var(--color-base-200)", background: "oklch(0.975 0.003 240)" }}
                    >
                      <div className="flex items-end justify-between gap-6 flex-wrap">
                        {/* Breakdown lines */}
                        <div className="space-y-1.5 text-sm min-w-[240px]">
                          <div className="flex justify-between gap-8">
                            <span style={{ color: "var(--text-muted)" }}>
                              Cleaning fees ({k.bookings.length} job{k.bookings.length !== 1 ? "s" : ""})
                            </span>
                            <span className="tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                              {ngnKobo(k.total_clean_kobo)}
                            </span>
                          </div>
                          {k.total_transport_ngn > 0 && (
                            <div className="flex justify-between gap-8">
                              <span style={{ color: "var(--text-muted)" }}>Transport reimbursements</span>
                              <span className="tabular-nums font-medium" style={{ color: "oklch(0.45 0.12 145)" }}>
                                + {ngnAmt(k.total_transport_ngn)}
                              </span>
                            </div>
                          )}
                          <div
                            className="flex justify-between gap-8 pt-1.5 border-t"
                            style={{ borderColor: "var(--color-base-200)" }}
                          >
                            <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
                              Total to transfer
                            </span>
                            <span
                              className="tabular-nums font-bold text-base"
                              style={{ color: "var(--color-primary)" }}
                            >
                              {ngnAmt(k.total_payout_ngn)}
                            </span>
                          </div>
                        </div>

                        {/* Mark paid action */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {as?.busy ? (
                            <Spinner size="sm" />
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleMarkPaid(k)}
                            >
                              Mark as paid out
                            </button>
                          )}
                          {as?.msg && (
                            <p
                              className="text-xs"
                              style={{ color: as.isError ? "var(--color-error)" : "oklch(0.45 0.12 145)" }}
                            >
                              {as.isError ? "⚠ " : "✓ "}{as.msg}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Paystack Transfer notice ───────────────────────── */}
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "oklch(0.97 0.01 240)", border: "1px solid oklch(0.85 0.04 240)" }}
          >
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              viewBox="0 0 24 24" fill="currentColor"
              style={{ color: "oklch(0.5 0.1 250)" }}
            >
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-semibold" style={{ color: "oklch(0.4 0.1 250)" }}>
                Automated bank transfers — coming soon
              </p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.07 250)" }}>
                Transfer each Keeper manually by bank app, then hit "Mark as paid out" to clear their ledger. Paystack Transfers automation requires BVN/CAC verification — go to Paystack dashboard → Settings → Transfers to activate.
              </p>
            </div>
          </div>

          {/* ── Payout history ─────────────────────────────────── */}
          {history.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-base-200)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                  Payout history
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "oklch(0.97 0.003 240)" }}>
                    {["Keeper", "Amount", "Method", "Bank", "Status", "Date"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
                  {history.map((r) => (
                    <tr key={r.id} className="hover:bg-base-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium" style={{ color: "var(--text-strong)" }}>
                        {r.cleaner_first_name} {r.cleaner_last_name}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                        {ngnKobo(r.total_kobo)}
                      </td>
                      <td className="px-5 py-3.5 capitalize" style={{ color: "var(--text-muted)" }}>
                        {r.method}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--text-muted)" }}>
                        {r.bank_name ? `${r.bank_name} ****${r.account_number?.slice(-4) ?? ""}` : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge badge-sm badge-soft ${STATUS_BADGE[r.status] ?? "badge-neutral"}`}>
                          {r.status}
                        </span>
                        {r.failure_reason && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-error)" }}>{r.failure_reason}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(r.completed_at ?? r.initiated_at ?? r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
