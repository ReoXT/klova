"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";

/* ── Types ───────────────────────────────────────────────────── */

type Cleaner = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  status: string;
  zone: { name: string } | null;
};

type SlotStatus = "free" | "booked" | "none";
type SlotsMap   = Record<string, SlotStatus>;

/* ── Date helpers (no-timezone, all YYYY-MM-DD) ──────────────── */

function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMondayOf(d: Date): Date {
  const r   = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Returns 5 weeks, each as array of 7 date-strings (Mon→Sun) */
function buildWeeks(from: Date, count = 5): string[][] {
  return Array.from({ length: count }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => toStr(addDays(from, wi * 7 + di))),
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtShort(s: string): string {
  const d = parseDate(s);
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}
function fmtWeekRange(week: string[]): string {
  const a = parseDate(week[0]);
  const b = parseDate(week[6]);
  const mo = a.toLocaleDateString("en-NG", { month: "short" });
  const moB = b.toLocaleDateString("en-NG", { month: "short" });
  return mo === moB
    ? `${mo} ${a.getDate()}–${b.getDate()}`
    : `${mo} ${a.getDate()} – ${moB} ${b.getDate()}`;
}

function isToday(s: string): boolean { return s === toStr(new Date()); }
function isPast(s: string): boolean  { return s < toStr(new Date()); }

/* ── Avatar ──────────────────────────────────────────────────── */

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function AvailabilityPage() {
  const [cleaners, setCleaners]         = useState<Cleaner[]>([]);
  const [cleanersLoading, setCleanersLoading] = useState(true);
  const [selected, setSelected]         = useState<Cleaner | null>(null);

  // Start from this week's Monday
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));

  // Slot state
  const [originalSlots, setOriginalSlots] = useState<SlotsMap>({});
  const [slots, setSlots]                 = useState<SlotsMap>({});
  const [slotsLoading, setSlotsLoading]   = useState(false);

  // Save state
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  // Build weeks grid
  const weeks = useMemo(() => buildWeeks(weekStart, 5), [weekStart]);
  const rangeFrom = weeks[0][0];
  const rangeTo   = weeks[4][6];

  // Load cleaners once
  useEffect(() => {
    fetch("/api/admin/cleaners")
      .then((r) => r.json())
      .then((d) => {
        const list: Cleaner[] = (d.cleaners ?? []).filter((c: Cleaner) => c.status === "active");
        setCleaners(list);
        if (list.length) setSelected(list[0]);
      })
      .finally(() => setCleanersLoading(false));
  }, []);

  // Load slots when cleaner or week range changes
  const loadSlots = useCallback(async (cleanerId: string, from: string, to: string) => {
    setSlotsLoading(true);
    setSaveMsg(null);
    try {
      const r = await fetch(`/api/admin/availability?cleaner_id=${cleanerId}&from=${from}&to=${to}`);
      const d = await r.json();
      const map: SlotsMap = {};
      for (const s of (d.slots ?? [])) {
        map[s.available_date] = s.is_booked ? "booked" : "free";
      }
      setOriginalSlots(map);
      setSlots(map);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadSlots(selected.id, rangeFrom, rangeTo);
  }, [selected?.id, rangeFrom, loadSlots]);

  // Diff
  const toAdd = useMemo(
    () => Object.entries(slots)
      .filter(([d, s]) => s === "free" && (originalSlots[d] ?? "none") === "none")
      .map(([d]) => d),
    [slots, originalSlots],
  );
  const toRemove = useMemo(
    () => Object.entries(slots)
      .filter(([d, s]) => s === "none" && originalSlots[d] === "free")
      .map(([d]) => d),
    [slots, originalSlots],
  );
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  function selectCleaner(c: Cleaner) {
    if (hasChanges && !window.confirm("You have unsaved changes. Switch cleaner anyway?")) return;
    setSelected(c);
    setSlots({});
    setOriginalSlots({});
    setSaveMsg(null);
  }

  function toggleDate(date: string) {
    const current = slots[date] ?? "none";
    if (current === "booked") {
      alert(`${fmtShort(date)} already has a booking. Handle the booking first before removing this slot.`);
      return;
    }
    setSaveMsg(null);
    setSlots((prev) => ({ ...prev, [date]: current === "free" ? "none" : "free" }));
  }

  function bulkWeek(week: string[], mode: "weekdays" | "all" | "clear") {
    const dates = mode === "weekdays" ? week.slice(0, 5) : week;
    setSaveMsg(null);
    setSlots((prev) => {
      const next = { ...prev };
      if (mode === "clear") {
        dates.forEach((d) => { if ((next[d] ?? "none") === "free") next[d] = "none"; });
      } else {
        dates.forEach((d) => { if ((next[d] ?? "none") !== "booked") next[d] = "free"; });
      }
      return next;
    });
  }

  async function save() {
    if (!selected || !hasChanges) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_id: selected.id, add: toAdd, remove: toRemove }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");

      const parts: string[] = [];
      if (d.added)   parts.push(`${d.added} slot${d.added !== 1 ? "s" : ""} added`);
      if (d.removed) parts.push(`${d.removed} slot${d.removed !== 1 ? "s" : ""} removed`);
      const blocked = d.blocked?.length ?? 0;

      setSaveMsg({
        ok: blocked === 0,
        text: blocked > 0
          ? `Saved. ${blocked} booked date${blocked > 1 ? "s" : ""} could not be removed. Handle the booking first.`
          : `Saved: ${parts.join(", ")}.`,
      });

      await loadSlots(selected.id, rangeFrom, rangeTo);
    } catch {
      setSaveMsg({ ok: false, text: "Save failed. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  function shiftWeeks(n: number) {
    if (hasChanges && !window.confirm("You have unsaved changes. Navigate anyway?")) return;
    setWeekStart((prev) => addDays(prev, n * 7));
    setSaveMsg(null);
  }

  function jumpToToday() {
    if (hasChanges && !window.confirm("You have unsaved changes. Navigate anyway?")) return;
    setWeekStart(getMondayOf(new Date()));
    setSaveMsg(null);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Cleaner sidebar ── */}
      <div
        className="w-52 shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ borderColor: "var(--border-subtle)", background: "var(--surface-card)" }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Active cleaners
          </p>
        </div>

        {cleanersLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : cleaners.length === 0 ? (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>No active cleaners.</p>
        ) : (
          <ul className="flex flex-col py-2">
            {cleaners.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => selectCleaner(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-base-200 ${selected?.id === c.id ? "bg-primary/8 border-l-2 border-primary" : ""}`}
                >
                  <Avatar url={c.photo_url} name={`${c.first_name} ${c.last_name}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.zone?.name ?? ""}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Nav bar */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)", background: "var(--surface-card)" }}
        >
          <div className="flex items-center gap-2">
            <button onClick={() => shiftWeeks(-1)} className="btn btn-ghost btn-xs btn-circle">◀</button>
            <span className="text-sm font-medium w-52 text-center">
              {fmtShort(rangeFrom)} – {fmtShort(rangeTo)}
            </span>
            <button onClick={() => shiftWeeks(1)}  className="btn btn-ghost btn-xs btn-circle">▶</button>
            <button onClick={jumpToToday} className="btn btn-ghost btn-xs">Today</button>
          </div>

          <div className="flex items-center gap-3">
            {saveMsg && (
              <p className={`text-xs ${saveMsg.ok ? "text-success" : "text-error"}`}>
                {saveMsg.text}
              </p>
            )}
            {hasChanges && (
              <span className="badge badge-sm badge-warning badge-soft">
                {toAdd.length + toRemove.length} unsaved
              </span>
            )}
            <Button
              size="sm"
              onClick={save}
              disabled={!hasChanges || saving || !selected}
            >
              {saving ? <Spinner /> : `Save${hasChanges ? ` (${toAdd.length + toRemove.length})` : ""}`}
            </Button>
          </div>
        </div>

        {/* Grid */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: "var(--text-muted)" }} className="text-sm">Select a cleaner to edit availability.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">

            {/* Column headers (sticky) */}
            <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1.5 mb-1 sticky top-0 z-10 pb-1"
              style={{ background: "var(--surface-base)" }}>
              <div />
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold py-1"
                  style={{ color: "var(--text-muted)" }}>
                  {d}
                </div>
              ))}
            </div>

            {slotsLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : (
              weeks.map((week) => {
                const pending = week.filter((d) => {
                  const orig = originalSlots[d] ?? "none";
                  const cur  = slots[d] ?? "none";
                  return orig !== cur;
                }).length;

                return (
                  <div key={week[0]}>
                    <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1.5 items-start">
                      {/* Week label + bulk buttons */}
                      <div className="flex flex-col gap-1.5 pt-1">
                        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                          {fmtWeekRange(week)}
                        </p>
                        {pending > 0 && (
                          <span className="badge badge-xs badge-warning badge-soft">{pending} changed</span>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <button className="btn btn-xs btn-ghost px-2 h-6 min-h-0 text-xs"
                            onClick={() => bulkWeek(week, "weekdays")} title="Set Mon–Fri">
                            Wkdays
                          </button>
                          <button className="btn btn-xs btn-ghost px-2 h-6 min-h-0 text-xs"
                            onClick={() => bulkWeek(week, "all")} title="Set all 7 days">
                            All
                          </button>
                          <button className="btn btn-xs btn-ghost px-2 h-6 min-h-0 text-xs text-error hover:text-error"
                            onClick={() => bulkWeek(week, "clear")} title="Clear all free slots">
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Day cells */}
                      {week.map((date) => {
                        const original = originalSlots[date] ?? "none";
                        const current  = slots[date] ?? "none";
                        const changed  = original !== current;
                        return (
                          <DayCell
                            key={date}
                            date={date}
                            status={current}
                            changed={changed}
                            onToggle={toggleDate}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── DayCell ─────────────────────────────────────────────────── */

function DayCell({
  date, status, changed, onToggle,
}: {
  date: string;
  status: SlotStatus;
  changed: boolean;
  onToggle: (d: string) => void;
}) {
  const d       = parseDate(date);
  const dayNum  = d.getDate();
  const today   = isToday(date);
  const past    = isPast(date);

  const base = "relative rounded-xl border-2 flex flex-col items-center justify-center py-3 gap-0.5 select-none transition-all text-sm font-medium";

  if (status === "booked") {
    return (
      <button
        className={`${base} cursor-not-allowed`}
        style={{
          background:   "oklch(91% 0.05 75)",
          borderColor:  "oklch(78% 0.1 75)",
          color:        "oklch(55% 0.12 75)",
        }}
        onClick={() => onToggle(date)}
        title="Already booked, remove the booking first"
      >
        <span className="text-base">{dayNum}</span>
        <span className="text-[9px] uppercase tracking-wide font-semibold opacity-80">Booked</span>
        <span className="absolute top-1 right-1.5 text-[10px]">🔒</span>
      </button>
    );
  }

  if (status === "free") {
    return (
      <button
        className={`${base} hover:scale-[1.03] active:scale-100`}
        style={{
          background:  changed ? "oklch(88% 0.12 155)" : "oklch(92% 0.08 155)",
          borderColor: changed ? "oklch(62% 0.18 155)" : "oklch(78% 0.12 155)",
          color:       "oklch(38% 0.14 155)",
          opacity:     past ? 0.65 : 1,
          outline:     changed ? "2px dashed oklch(62% 0.18 155)" : "none",
          outlineOffset: "2px",
        }}
        onClick={() => onToggle(date)}
      >
        <span className="text-base">{dayNum}</span>
        <span className="text-[9px] uppercase tracking-wide font-semibold opacity-75">Free</span>
        {today && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
      </button>
    );
  }

  // none / not available
  return (
    <button
      className={`${base} hover:scale-[1.03] active:scale-100`}
      style={{
        background:  changed ? "oklch(95% 0.04 30)" : "var(--surface-card)",
        borderColor: changed ? "oklch(75% 0.12 30)" : "var(--border-subtle)",
        borderStyle: changed ? "dashed" : "dashed",
        color:       changed ? "oklch(50% 0.12 30)" : "var(--text-subtle)",
        opacity:     past ? 0.5 : 1,
      }}
      onClick={() => onToggle(date)}
    >
      <span className="text-base">{dayNum}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-50">{changed ? "Adding…" : "Off"}</span>
      {today && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
    </button>
  );
}
