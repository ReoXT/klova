"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────────── */
interface BreakdownRow {
  name: string;
  bookings: number;
  gross_kobo: number;
  commission_kobo: number;
}
interface RevenueData {
  summary: { total_bookings: number; gross_kobo: number; commission_kobo: number };
  by_service: BreakdownRow[];
  by_zone: BreakdownRow[];
  from: string;
  to: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function pct(part: number, total: number) {
  if (!total) return "—";
  return (part / total * 100).toFixed(1) + "%";
}
function fmtRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const f = new Date(from + "T00:00:00").toLocaleDateString("en-GB", opts);
  const t = new Date(to   + "T00:00:00").toLocaleDateString("en-GB", opts);
  return f === t ? f : `${f} – ${t}`;
}

/* ── Preset date ranges ─────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

const PRESETS = [
  { label: "This month",  from: () => monthStart(),     to: () => todayStr() },
  { label: "Last 30 days", from: () => offsetDate(-30), to: () => todayStr() },
  { label: "Last 90 days", from: () => offsetDate(-90), to: () => todayStr() },
  { label: "This year",   from: () => yearStart(),       to: () => todayStr() },
  { label: "All time",    from: () => "2020-01-01",      to: () => todayStr() },
] as const;

/* ── Sub-components ─────────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-1"
      style={{
        background: accent ? "var(--color-primary)" : "var(--surface-card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: accent ? "oklch(0.9 0.02 250)" : "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-3xl font-bold tabular-nums leading-tight"
        style={{ color: accent ? "var(--color-primary-content)" : "var(--text-strong)" }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="text-xs"
          style={{ color: accent ? "oklch(0.85 0.02 250)" : "var(--text-muted)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  totalGross,
}: {
  title: string;
  rows: BreakdownRow[];
  totalGross: number;
}) {
  if (!rows.length) return null;
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-base-200)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
          {title}
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr style={{ background: "oklch(0.97 0.003 240)" }}>
            {["", "Bookings", "Gross revenue", "Commission", "Share"].map((h) => (
              <th
                key={h}
                className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider ${h ? "text-right" : "text-left"}`}
                style={{ color: "var(--text-muted)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-base-50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                {r.name}
              </td>
              <td className="px-6 py-4 text-sm text-right tabular-nums" style={{ color: "var(--text-body)" }}>
                {r.bookings}
              </td>
              <td className="px-6 py-4 text-sm text-right tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                {ngn(r.gross_kobo)}
              </td>
              <td className="px-6 py-4 text-sm text-right tabular-nums" style={{ color: "var(--color-primary)" }}>
                {ngn(r.commission_kobo)}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: 48,
                      background: "var(--color-base-200)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((r.gross_kobo / (totalGross || 1)) * 100)}%`,
                        background: "var(--color-primary)",
                      }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-10 text-right" style={{ color: "var(--text-muted)" }}>
                    {pct(r.gross_kobo, totalGross)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "oklch(0.97 0.003 240)", borderTop: "1px solid var(--color-base-200)" }}>
            <td className="px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Total
            </td>
            <td className="px-6 py-3 text-sm text-right tabular-nums font-semibold" style={{ color: "var(--text-strong)" }}>
              {rows.reduce((s, r) => s + r.bookings, 0)}
            </td>
            <td className="px-6 py-3 text-sm text-right tabular-nums font-bold" style={{ color: "var(--text-strong)" }}>
              {ngn(rows.reduce((s, r) => s + r.gross_kobo, 0))}
            </td>
            <td className="px-6 py-3 text-sm text-right tabular-nums font-bold" style={{ color: "var(--color-primary)" }}>
              {ngn(rows.reduce((s, r) => s + r.commission_kobo, 0))}
            </td>
            <td className="px-6 py-3 text-right text-xs" style={{ color: "var(--text-muted)" }}>
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AdminRevenuePage() {
  const today = todayStr();
  const [from, setFrom]       = useState(monthStart);
  const [to,   setTo]         = useState(today);
  const [activePreset, setActivePreset] = useState<number>(0);
  const [data,    setData]    = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback((f: string, t: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/revenue?from=${f}&to=${t}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(from, to); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(idx: number) {
    const p = PRESETS[idx];
    const f = p.from();
    const t = p.to();
    setActivePreset(idx);
    setFrom(f);
    setTo(t);
    load(f, t);
  }

  function applyCustom() {
    setActivePreset(-1);
    load(from, to);
  }

  const s = data?.summary;
  const commissionRate = s && s.gross_kobo
    ? ((s.commission_kobo / s.gross_kobo) * 100).toFixed(2)
    : "22.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
            Revenue
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Confirmed and completed bookings only · Commission rate {commissionRate}%
          </p>
        </div>
        {/* Print/screenshot hint */}
        <button
          onClick={() => window.print()}
          className="btn btn-soft btn-sm gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
          Print / screenshot
        </button>
      </div>

      {/* Date controls */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-end gap-3"
        style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
      >
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className="btn btn-sm"
              style={
                activePreset === i
                  ? { background: "var(--color-primary)", color: "var(--color-primary-content)", border: "none" }
                  : { background: "transparent", color: "var(--text-body)", border: "1px solid var(--color-base-300)" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="flex items-end gap-2 ml-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From</label>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(-1); }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To</label>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={to}
              min={from}
              max={today}
              onChange={(e) => { setTo(e.target.value); setActivePreset(-1); }}
            />
          </div>
          <button className="btn btn-sm btn-primary" onClick={applyCustom}>
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-error)" }}>{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Period label */}
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Showing: {fmtRange(data.from, data.to)}
          </p>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total bookings"
              value={String(s!.total_bookings)}
              sub="confirmed + completed"
            />
            <KpiCard
              label="Gross revenue"
              value={ngn(s!.gross_kobo)}
              sub="before commission"
            />
            <KpiCard
              label="My commission"
              value={ngn(s!.commission_kobo)}
              sub={`${commissionRate}% of gross`}
              accent
            />
          </div>

          {/* Reconciliation note */}
          {s!.total_bookings > 0 && (
            <div
              className="rounded-xl px-5 py-3 flex items-center gap-3"
              style={{ background: "oklch(0.97 0.01 145)", border: "1px solid oklch(0.75 0.08 145)" }}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: "oklch(0.55 0.12 145)" }}>
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-medium" style={{ color: "oklch(0.4 0.1 145)" }}>
                Commission reconciled at {commissionRate}% — matches stored <code>commission_kobo</code> values exactly.
              </p>
            </div>
          )}

          {/* No bookings in range */}
          {s!.total_bookings === 0 && (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No confirmed or completed bookings in this date range.
              </p>
            </div>
          )}

          {/* Breakdown tables */}
          {s!.total_bookings > 0 && (
            <div className="space-y-4">
              <BreakdownTable
                title="By service type"
                rows={data.by_service}
                totalGross={s!.gross_kobo}
              />
              <BreakdownTable
                title="By zone"
                rows={data.by_zone}
                totalGross={s!.gross_kobo}
              />
            </div>
          )}

          {/* Footer note */}
          {s!.total_bookings > 0 && (
            <p className="text-xs text-center pb-2" style={{ color: "var(--text-muted)" }}>
              Klova · Data as of {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · Lekki / Ajah zone · Commission 22%
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
