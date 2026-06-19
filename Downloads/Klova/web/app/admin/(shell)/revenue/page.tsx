"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────────── */
interface BreakdownRow {
  name: string;
  bookings: number;
  gross_kobo: number;
  cleaning_fee_kobo: number;
  addons_kobo: number;
  insurance_kobo: number;
  commission_kobo: number;
}
interface Summary {
  total_bookings: number;
  gross_kobo: number;
  cleaning_fee_kobo: number;
  base_kobo: number;
  addons_kobo: number;
  insurance_kobo: number;
  commission_kobo: number;
}
interface RevenueData {
  summary: Summary;
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

/* ── Date presets ───────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().split("T")[0]; }
function offsetDate(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function yearStart() { return `${new Date().getFullYear()}-01-01`; }

const PRESETS = [
  { label: "This month",   from: () => monthStart(),     to: () => todayStr() },
  { label: "Last 30 days", from: () => offsetDate(-30),  to: () => todayStr() },
  { label: "Last 90 days", from: () => offsetDate(-90),  to: () => todayStr() },
  { label: "This year",    from: () => yearStart(),       to: () => todayStr() },
  { label: "All time",     from: () => "2020-01-01",      to: () => todayStr() },
] as const;

/* ── Sub-components ─────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
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

function SplitBar({ cleaningKobo, insuranceKobo }: { cleaningKobo: number; insuranceKobo: number }) {
  const total = cleaningKobo + insuranceKobo;
  if (!total) return null;
  const cleanPct = Math.round((cleaningKobo / total) * 100);
  const insPct   = 100 - cleanPct;
  return (
    <div className="flex rounded-full overflow-hidden h-2 w-full">
      <div style={{ width: `${cleanPct}%`, background: "var(--color-primary)" }} />
      <div style={{ width: `${insPct}%`,  background: "oklch(0.72 0.11 145)" }} />
    </div>
  );
}

function BreakdownTable({ title, rows, totalGross }: {
  title: string; rows: BreakdownRow[]; totalGross: number;
}) {
  if (!rows.length) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      bookings:          acc.bookings          + r.bookings,
      gross_kobo:        acc.gross_kobo        + r.gross_kobo,
      cleaning_fee_kobo: acc.cleaning_fee_kobo + r.cleaning_fee_kobo,
      insurance_kobo:    acc.insurance_kobo    + r.insurance_kobo,
      commission_kobo:   acc.commission_kobo   + r.commission_kobo,
    }),
    { bookings: 0, gross_kobo: 0, cleaning_fee_kobo: 0, insurance_kobo: 0, commission_kobo: 0 },
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-base-200)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "oklch(0.97 0.003 240)" }}>
            {[
              { label: "",              align: "left"  },
              { label: "Bookings",      align: "right" },
              { label: "Gross",         align: "right" },
              { label: "Cleaning fees", align: "right" },
              { label: "Insurance",     align: "right" },
              { label: "Commission",    align: "right" },
              { label: "Share",         align: "right" },
            ].map(({ label, align }) => (
              <th
                key={label}
                className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-${align}`}
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--color-base-200)" }}>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-base-50 transition-colors">
              <td className="px-5 py-3.5 font-medium" style={{ color: "var(--text-strong)" }}>
                {r.name}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-body)" }}>
                {r.bookings}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums font-medium" style={{ color: "var(--text-strong)" }}>
                {ngn(r.gross_kobo)}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "var(--text-body)" }}>
                {ngn(r.cleaning_fee_kobo)}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: "oklch(0.55 0.12 145)" }}>
                {r.insurance_kobo ? ngn(r.insurance_kobo) : "—"}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums font-medium" style={{ color: "var(--color-primary)" }}>
                {ngn(r.commission_kobo)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 rounded-full" style={{ width: 40, background: "var(--color-base-200)" }}>
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
            <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Total
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "var(--text-strong)" }}>
              {totals.bookings}
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-bold" style={{ color: "var(--text-strong)" }}>
              {ngn(totals.gross_kobo)}
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "var(--text-body)" }}>
              {ngn(totals.cleaning_fee_kobo)}
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "oklch(0.55 0.12 145)" }}>
              {totals.insurance_kobo ? ngn(totals.insurance_kobo) : "—"}
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-bold" style={{ color: "var(--color-primary)" }}>
              {ngn(totals.commission_kobo)}
            </td>
            <td className="px-5 py-3 text-right text-xs" style={{ color: "var(--text-muted)" }}>
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
  const [from, setFrom]             = useState(monthStart);
  const [to,   setTo]               = useState(today);
  const [activePreset, setPreset]   = useState<number>(0);
  const [data,    setData]          = useState<RevenueData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState<string | null>(null);

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
    const f = p.from(); const t = p.to();
    setPreset(idx); setFrom(f); setTo(t); load(f, t);
  }
  function applyCustom() { setPreset(-1); load(from, to); }

  const s = data?.summary;
  const commissionRate = s && s.gross_kobo
    ? ((s.commission_kobo / s.gross_kobo) * 100).toFixed(2)
    : "22.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>Revenue</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Confirmed and completed bookings only · Commission on cleaning fees: 22%
          </p>
        </div>
        <button onClick={() => window.print()} className="btn btn-soft btn-sm gap-1.5">
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
        <div className="flex items-end gap-2 ml-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From</label>
            <input type="date" className="input input-sm input-bordered" value={from} max={to}
              onChange={(e) => { setFrom(e.target.value); setPreset(-1); }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To</label>
            <input type="date" className="input input-sm input-bordered" value={to} min={from} max={today}
              onChange={(e) => { setTo(e.target.value); setPreset(-1); }} />
          </div>
          <button className="btn btn-sm btn-primary" onClick={applyCustom}>Apply</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
          <p className="text-sm" style={{ color: "var(--color-error)" }}>{error}</p>
        </div>
      ) : data ? (
        <>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Showing: {fmtRange(data.from, data.to)}
          </p>

          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total bookings"
              value={String(s!.total_bookings)}
              sub="confirmed + completed"
            />
            <KpiCard
              label="Gross revenue"
              value={ngn(s!.gross_kobo)}
              sub="cleaning fees + insurance"
            />
            <KpiCard
              label="My commission"
              value={ngn(s!.commission_kobo)}
              sub={`22% of cleaning + 100% of insurance`}
              accent
            />
          </div>

          {/* Price breakdown strip */}
          {s!.total_bookings > 0 && (
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Gross revenue breakdown
              </p>

              {/* Split bar */}
              <SplitBar cleaningKobo={s!.cleaning_fee_kobo} insuranceKobo={s!.insurance_kobo} />

              {/* Two columns: cleaning | insurance */}
              <div className="grid grid-cols-2 gap-4">
                {/* Cleaning fees */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      CLEANING FEES ({pct(s!.cleaning_fee_kobo, s!.gross_kobo)})
                    </p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
                    {ngn(s!.cleaning_fee_kobo)}
                  </p>
                  <div className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    <div className="flex justify-between">
                      <span>Base price</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-body)" }}>{ngn(s!.base_kobo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Add-ons</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-body)" }}>
                        {s!.addons_kobo ? ngn(s!.addons_kobo) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5" style={{ borderColor: "var(--color-base-200)" }}>
                      <span>Klova cut (22%)</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--color-primary)" }}>
                        {ngn(Math.round(s!.cleaning_fee_kobo * 0.22))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cleaner payout (78%)</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-body)" }}>
                        {ngn(Math.round(s!.cleaning_fee_kobo * 0.78))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Insurance */}
                <div className="space-y-3" style={{ borderLeft: "1px solid var(--color-base-200)", paddingLeft: "1rem" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "oklch(0.72 0.11 145)" }} />
                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      INSURANCE ({pct(s!.insurance_kobo, s!.gross_kobo)})
                    </p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
                    {ngn(s!.insurance_kobo)}
                  </p>
                  <div className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    <div className="flex justify-between">
                      <span>₦1,300 flat per booking</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-body)" }}>
                        ×{s!.insurance_kobo ? Math.round(s!.insurance_kobo / 130000) : 0}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5" style={{ borderColor: "var(--color-base-200)" }}>
                      <span>Klova cut (100%)</span>
                      <span className="tabular-nums font-medium" style={{ color: "oklch(0.55 0.12 145)" }}>
                        {ngn(s!.insurance_kobo)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cleaner payout</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text-muted)" }}>₦0</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reconciliation footer */}
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-2.5"
                style={{ background: "oklch(0.97 0.01 145)", border: "1px solid oklch(0.8 0.07 145)" }}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: "oklch(0.55 0.12 145)" }}>
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-medium" style={{ color: "oklch(0.4 0.1 145)" }}>
                  Cleaning {ngn(Math.round(s!.cleaning_fee_kobo * 0.22))} + Insurance {ngn(s!.insurance_kobo)} = Commission {ngn(s!.commission_kobo)} · Reconciled ✓
                </p>
              </div>
            </div>
          )}

          {/* No bookings in range */}
          {s!.total_bookings === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No confirmed or completed bookings in this date range.
              </p>
            </div>
          )}

          {/* Breakdown tables */}
          {s!.total_bookings > 0 && (
            <div className="space-y-4">
              <BreakdownTable title="By service type" rows={data.by_service} totalGross={s!.gross_kobo} />
              <BreakdownTable title="By zone"          rows={data.by_zone}    totalGross={s!.gross_kobo} />
            </div>
          )}

          {/* Footer */}
          {s!.total_bookings > 0 && (
            <p className="text-xs text-center pb-2" style={{ color: "var(--text-muted)" }}>
              Klova · Data as of {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · Lekki / Ajah · Commission 22% on cleaning · Insurance 100% retained
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
