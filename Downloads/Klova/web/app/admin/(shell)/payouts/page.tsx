"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/* ── Types ─────────────────────────────────────────────────────────── */
interface KeeperWallet {
  cleaner_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  owed_earnings_kobo: number;
  owed_transport_kobo: number;
  withdrawn_or_pending_kobo: number;
  adjustments_kobo: number;
  available_kobo: number;
  total_earned_kobo: number;
  total_withdrawn_kobo: number;
}

type WithdrawalStatus = "pending" | "processing" | "success" | "failed" | "reversed";

interface Withdrawal {
  id: string;
  amount_kobo: number;
  status: WithdrawalStatus;
  method: string;
  failure_reason: string | null;
  paystack_transfer_reference: string | null;
  paystack_transfer_code: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  created_at: string;
  cleaner_id: string | null;
  cleaner_name: string;
  cleaner_phone: string | null;
  bank_name: string | null;
  account_number: string | null;
  can_retry: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_META: Record<WithdrawalStatus, { label: string; cls: string }> = {
  pending:    { label: "Pending",    cls: "badge-ghost" },
  processing: { label: "Processing", cls: "badge-info badge-soft" },
  success:    { label: "Success",   cls: "badge-success badge-soft" },
  failed:     { label: "Failed",    cls: "badge-error badge-soft" },
  reversed:   { label: "Reversed",  cls: "badge-warning badge-soft" },
};

/* ── Adjustment modal ──────────────────────────────────────────────── */
function AdjustmentModal({
  cleanerId,
  cleanerName,
  onClose,
  onSaved,
}: {
  cleanerId: string;
  cleanerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sign, setSign] = useState<"credit" | "debit">("credit");
  const [amountNgn, setAmountNgn] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const ngnValue = Number(amountNgn);
    if (!ngnValue || ngnValue <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!note.trim()) {
      setError("A note explaining this correction is required.");
      return;
    }
    setSubmitting(true);
    try {
      const amountKobo = Math.round(ngnValue * 100) * (sign === "debit" ? -1 : 1);
      const res = await fetch("/api/admin/payouts/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_id: cleanerId, amount_kobo: amountKobo, note: note.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't save adjustment.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save adjustment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 0.4)" }}>
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-lg)" }}
      >
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-strong)" }}>
            Adjust balance
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{cleanerName}</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--color-base-200)" }}>
          {(["credit", "debit"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSign(s)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={
                sign === s
                  ? { background: "var(--surface-card)", color: "var(--text-strong)", boxShadow: "var(--shadow-sm)" }
                  : { background: "transparent", color: "var(--text-muted)" }
              }
            >
              {s === "credit" ? "Credit (add)" : "Debit (remove)"}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount (₦)</label>
          <input
            type="number"
            min="1"
            step="1"
            className="input input-bordered w-full"
            value={amountNgn}
            onChange={(e) => setAmountNgn(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Note (required)
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this correction being made?"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={submitting}>Save adjustment</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function AdminPayoutsPage() {
  const [keepers, setKeepers] = useState<KeeperWallet[] | null>(null);
  const [keepersLoading, setKeepersLoading] = useState(true);
  const [keepersError, setKeepersError] = useState<string | null>(null);
  const [keeperSearch, setKeeperSearch] = useState("");

  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const [wLoading, setWLoading] = useState(true);
  const [wError, setWError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | WithdrawalStatus>("");
  const [wSearch, setWSearch] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<{ id: string; name: string } | null>(null);

  const loadKeepers = useCallback(() => {
    setKeepersLoading(true);
    setKeepersError(null);
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setKeepers(d.keepers);
      })
      .catch((e: Error) => setKeepersError(e.message))
      .finally(() => setKeepersLoading(false));
  }, []);

  const loadWithdrawals = useCallback((status: string, q: string) => {
    setWLoading(true);
    setWError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    fetch(`/api/admin/payouts/withdrawals?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setWithdrawals(d.withdrawals);
      })
      .catch((e: Error) => setWError(e.message))
      .finally(() => setWLoading(false));
  }, []);

  useEffect(() => { loadKeepers(); }, [loadKeepers]);
  useEffect(() => { loadWithdrawals(statusFilter, wSearch); }, [loadWithdrawals, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function searchWithdrawals(e: React.FormEvent) {
    e.preventDefault();
    loadWithdrawals(statusFilter, wSearch);
  }

  async function retry(id: string) {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/payouts/withdrawals/${id}/retry`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Retry failed.");
      loadWithdrawals(statusFilter, wSearch);
      loadKeepers();
    } catch (e) {
      setWError(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  }

  const filteredKeepers = (keepers ?? []).filter((k) => {
    if (!keeperSearch.trim()) return true;
    const q = keeperSearch.trim().toLowerCase();
    return (
      `${k.first_name} ${k.last_name}`.toLowerCase().includes(q) ||
      k.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>Payouts</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Read-only oversight of keeper wallets and withdrawals. Payouts are keeper-initiated;
          this screen mirrors what each keeper sees in their own wallet.
        </p>
      </div>

      {/* ── Keeper wallets ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Keeper wallets
          </h2>
          <input
            type="text"
            className="input input-sm input-bordered w-64"
            placeholder="Search keeper name or phone"
            value={keeperSearch}
            onChange={(e) => setKeeperSearch(e.target.value)}
          />
        </div>

        {keepersLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : keepersError ? (
          <Alert variant="error">{keepersError}</Alert>
        ) : filteredKeepers.length === 0 ? (
          <EmptyState heading="No keepers found" message="Try a different search." />
        ) : (
          <div
            className="rounded-2xl overflow-x-auto"
            style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.003 240)" }}>
                  {["Keeper", "Available", "Total earned", "Total withdrawn", ""].map((label, i) => (
                    <th
                      key={label || i}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
                {filteredKeepers.map((k) => (
                  <tr key={k.cleaner_id} className="hover:bg-base-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: "var(--text-strong)" }}>
                        {k.first_name} {k.last_name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{k.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold" style={{ color: "var(--color-primary)" }}>
                      {ngn(k.available_kobo)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-body)" }}>
                      {ngn(k.total_earned_kobo)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-body)" }}>
                      {ngn(k.total_withdrawn_kobo)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setAdjustTarget({ id: k.cleaner_id, name: `${k.first_name} ${k.last_name}` })}
                      >
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Withdrawals ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Withdrawals
          </h2>
          <form onSubmit={searchWithdrawals} className="flex items-center gap-2 flex-wrap">
            <select
              className="select select-sm select-bordered"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | WithdrawalStatus)}
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_META) as WithdrawalStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <input
              type="text"
              className="input input-sm input-bordered w-64"
              placeholder="Search keeper or reference"
              value={wSearch}
              onChange={(e) => setWSearch(e.target.value)}
            />
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
        </div>

        {wLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : wError ? (
          <Alert variant="error">{wError}</Alert>
        ) : !withdrawals || withdrawals.length === 0 ? (
          <EmptyState heading="No withdrawals found" message="Try a different filter or search." />
        ) : (
          <div
            className="rounded-2xl overflow-x-auto"
            style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.003 240)" }}>
                  {["Keeper", "Amount", "Status", "Bank", "Reference", "Requested", "Completed", ""].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-left"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
                {withdrawals.map((w) => {
                  const meta = STATUS_META[w.status] ?? { label: w.status, cls: "badge-ghost" };
                  return (
                    <tr key={w.id} className="hover:bg-base-50 transition-colors align-top">
                      <td className="px-5 py-3.5">
                        <p className="font-medium" style={{ color: "var(--text-strong)" }}>{w.cleaner_name}</p>
                        {w.cleaner_phone && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{w.cleaner_phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                        {ngn(w.amount_kobo)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge badge-sm ${meta.cls}`}>{meta.label}</span>
                        {w.status === "failed" && w.failure_reason && (
                          <p className="text-xs mt-1 max-w-48" style={{ color: "var(--color-error)" }}>
                            {w.failure_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--text-body)" }}>
                        {w.bank_name ? (
                          <>
                            {w.bank_name}
                            <br />
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              ****{w.account_number?.slice(-4)}
                            </span>
                          </>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {w.paystack_transfer_reference ?? "-"}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(w.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(w.completed_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {w.can_retry && (
                          <Button
                            variant="outline"
                            size="xs"
                            loading={retryingId === w.id}
                            onClick={() => retry(w.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjustTarget && (
        <AdjustmentModal
          cleanerId={adjustTarget.id}
          cleanerName={adjustTarget.name}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            setAdjustTarget(null);
            loadKeepers();
          }}
        />
      )}
    </div>
  );
}
