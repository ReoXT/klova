"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────── */
interface PendingCleaner {
  cleaner_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  unpaid_jobs: number;
  unpaid_kobo: number;
  has_bank_account: boolean;
  bank_account_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

interface HistoryRow {
  id: string;
  cleaner_id: string;
  cleaner_first_name: string;
  cleaner_last_name: string;
  total_kobo: number;
  method: string;
  status: string;
  failure_reason: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  created_at: string;
  bank_name: string | null;
  account_number: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────── */
function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
      style={{ background: "oklch(0.9 0.04 250)", color: "var(--color-primary)" }}>
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
  const [pending, setPending]   = useState<PendingCleaner[]>([]);
  const [history, setHistory]   = useState<HistoryRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Per-cleaner action state
  const [actionState, setActionState] = useState<Record<string, { busy: boolean; msg: string | null; isError: boolean }>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPending(d.pending ?? []);
        setHistory(d.history ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function setAction(cleanerId: string, busy: boolean, msg: string | null, isError = false) {
    setActionState((s) => ({ ...s, [cleanerId]: { busy, msg, isError } }));
  }

  async function handlePaystack(cleanerId: string) {
    setAction(cleanerId, true, null);
    try {
      const r = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_ids: [cleanerId] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Request failed");

      if (d.failed?.length > 0) {
        setAction(cleanerId, false, d.failed[0].reason, true);
      } else {
        setAction(cleanerId, false, "Transfer initiated — waiting for Paystack confirmation.", false);
        // Refresh after a moment
        setTimeout(load, 1500);
      }
    } catch (err) {
      setAction(cleanerId, false, err instanceof Error ? err.message : "Error", true);
    }
  }

  async function handleManual(c: PendingCleaner) {
    if (!c.has_bank_account) {
      setAction(c.cleaner_id, false, "Add a bank account in the Cleaners tab first.", true);
      return;
    }
    setAction(c.cleaner_id, true, null);
    try {
      const r = await fetch(`/api/admin/payouts/${c.cleaner_id}/mark-paid`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Request failed");
      setAction(c.cleaner_id, false, `Marked ${ngn(d.total_kobo)} as paid manually.`, false);
      load();
    } catch (err) {
      setAction(c.cleaner_id, false, err instanceof Error ? err.message : "Error", true);
    }
  }

  const totalUnpaid = pending.reduce((s, c) => s + c.unpaid_kobo, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>Payouts</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Weekly cleaner earnings — 78% of cleaning fees, paid after job completion
          </p>
        </div>
        <button onClick={load} className="btn btn-soft btn-sm gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
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
          {/* Summary strip */}
          {pending.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total owed</p>
                <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: "var(--color-primary)" }}>{ngn(totalUnpaid)}</p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cleaners owed</p>
                <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: "var(--text-strong)" }}>{pending.length}</p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total unpaid jobs</p>
                <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: "var(--text-strong)" }}>
                  {pending.reduce((s, c) => s + c.unpaid_jobs, 0)}
                </p>
              </div>
            </div>
          )}

          {/* Pending payouts */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-base-200)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                Unpaid earnings
              </h2>
              <span className="badge badge-sm badge-soft badge-warning">{pending.length} cleaners</span>
            </div>

            {pending.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>All cleaners are paid up to date.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
                {pending.map((c) => {
                  const as = actionState[c.cleaner_id];
                  return (
                    <div key={c.cleaner_id} className="px-5 py-4">
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Cleaner info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar url={c.photo_url} name={`${c.first_name} ${c.last_name}`} />
                          <div className="min-w-0">
                            <p className="font-medium text-sm" style={{ color: "var(--text-strong)" }}>
                              {c.first_name} {c.last_name}
                            </p>
                            {c.has_bank_account ? (
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {c.bank_name} · ****{c.account_number?.slice(-4) ?? "—"}
                              </p>
                            ) : (
                              <p className="text-xs text-warning font-medium">No bank account on file</p>
                            )}
                          </div>
                        </div>

                        {/* Amount + jobs */}
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
                            {ngn(c.unpaid_kobo)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {c.unpaid_jobs} job{c.unpaid_jobs !== 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {as?.busy ? (
                            <Spinner size="sm" />
                          ) : (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handlePaystack(c.cleaner_id)}
                                disabled={!c.has_bank_account}
                                title={!c.has_bank_account ? "Add a bank account first" : "Send via Paystack Transfer"}
                              >
                                Send via Paystack
                              </button>
                              <button
                                className="btn btn-sm btn-soft"
                                onClick={() => handleManual(c)}
                              >
                                Mark paid manually
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action feedback */}
                      {as?.msg && (
                        <p
                          className="text-xs mt-2 ml-11"
                          style={{ color: as.isError ? "var(--color-error)" : "oklch(0.45 0.12 145)" }}
                        >
                          {as.isError ? "⚠ " : "✓ "}{as.msg}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paystack Transfers notice */}
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "oklch(0.97 0.01 240)", border: "1px solid oklch(0.85 0.04 240)" }}
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: "oklch(0.5 0.1 250)" }}>
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-semibold" style={{ color: "oklch(0.4 0.1 250)" }}>
                Paystack Transfers requires activation
              </p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.07 250)" }}>
                To enable "Send via Paystack", go to your Paystack dashboard → Settings → Transfers and complete the BVN/CAC verification. Once activated, the button works automatically — no code changes needed. Until then, use "Mark paid manually" after transferring through your bank.
              </p>
            </div>
          </div>

          {/* Payout history */}
          {history.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-base-200)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>Payout history</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "oklch(0.97 0.003 240)" }}>
                    {["Cleaner", "Amount", "Method", "Bank", "Status", "Date"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
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
                        {ngn(r.total_kobo)}
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
