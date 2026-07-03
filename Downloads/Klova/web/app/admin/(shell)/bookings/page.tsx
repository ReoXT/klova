"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import {
  BookingStatusBadge,
  type BookingStatus,
} from "@/components/admin/BookingStatusBadge";

/* ── Types ─────────────────────────────────────────────────── */

type TransportStatus = "pending_quote" | "awaiting_payment" | "paid" | "waived" | "not_required";

type KeeperProfile = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url: string | null;
  nin_verified: boolean;
  rating: number | null;
  total_jobs: number;
  home_area: string | null;
};

type BookingCleaner = {
  id: string;                       // booking_cleaners PK
  role: "lead" | "second";
  paid_out: boolean;
  transport_fare_kobo: number | null;
  cleaner: KeeperProfile | null;
};

type Booking = {
  id: string;
  bedrooms: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  total_amount_kobo: number;
  commission_kobo: number;
  keeper_count: number;
  status: BookingStatus;
  paystack_reference: string | null;
  refunded_at: string | null;
  // transport
  transport_fare: number | null;
  transport_status: TransportStatus;
  transport_payment_ref: string | null;
  transport_paid_at: string | null;
  transport_awaiting_since: string | null;
  dispatched_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
  };
  // backward-compat single cleaner (lead)
  cleaner: KeeperProfile | null;
  zone: { id: string; name: string; slug: string };
  service: { id: string; name: string; slug: string };
  booking_addons: Array<{
    addon: { id: string; name: string; slug: string; amount_kobo: number };
  }>;
  // all assigned keepers from booking_cleaners
  booking_cleaners: BookingCleaner[];
};

type Zone = { id: string; name: string; slug: string; is_active: boolean };

type AvailableCleaner = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url: string | null;
  nin_verified: boolean;
  rating: number | null;
  total_jobs: number;
};

/* ── Constants ──────────────────────────────────────────────── */

const STATUS_FILTERS: { key: string | null; label: string }[] = [
  { key: null,          label: "All" },
  { key: "matched",     label: "Matched" },
  { key: "confirmed",   label: "Confirmed" },
  { key: "completed",   label: "Completed" },
  { key: "cancelled",   label: "Cancelled" },
  { key: "no_match",    label: "No Match" },
];

/* ── Helpers ────────────────────────────────────────────────── */

function formatNGN(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortRef(id: string) {
  return id.slice(-8).toUpperCase();
}

function formatBedrooms(b: string) {
  return `${b} bed`;
}

/* ── Page ───────────────────────────────────────────────────── */

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  useEffect(() => {
    fetch("/api/admin/zones")
      .then((r) => r.json())
      .then((d) => setZones(d.zones ?? []))
      .catch(() => {});
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (zoneId) params.set("zone_id", zoneId);
    try {
      const r = await fetch(`/api/admin/bookings?${params}`);
      if (r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Unknown error");
      setBookings(d.bookings ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
    } catch {
      setFetchError("Failed to load bookings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [page, status, zoneId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function refreshSelected(id: string) {
    try {
      const r = await fetch(`/api/admin/bookings/${id}`);
      const d = await r.json();
      if (r.ok && d.booking) {
        setSelected(d.booking);
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? d.booking : b)),
        );
      }
    } catch {}
  }

  function handleStatusChange(s: string | null) {
    setStatus(s);
    setPage(1);
    setSelected(null);
  }

  function handleZoneChange(z: string) {
    setZoneId(z || null);
    setPage(1);
    setSelected(null);
  }

  function toggleSelected(b: Booking) {
    setSelected((prev) => (prev?.id === b.id ? null : b));
  }

  // Summary cleaner label for the table (lead keeper or "-")
  function tableCleanerLabel(b: Booking) {
    const lead = b.booking_cleaners?.find((bc) => bc.role === "lead")?.cleaner ?? b.cleaner;
    if (!lead) return "-";
    const suffix = (b.keeper_count ?? 1) >= 2 ? " +1" : "";
    return `${lead.first_name} ${lead.last_name[0]}.${suffix}`;
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Main column ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: "var(--text-strong)" }}
            >
              Bookings
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Loading…" : `${total.toLocaleString()} total`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={label}
                onClick={() => handleStatusChange(key)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  status === key
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 hover:bg-base-300 text-base-content/70",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          {zones.length > 0 && (
            <select
              value={zoneId ?? ""}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="select select-sm ml-auto"
              style={{ minWidth: 140 }}
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Table card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {loading ? (
            <div className="flex justify-center py-24">
              <Spinner size="lg" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <p className="text-sm text-error">{fetchError}</p>
              <button onClick={fetchBookings} className="btn btn-sm btn-ghost">
                Retry
              </button>
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon />}
              heading="No bookings found"
              message={
                status
                  ? "Try clearing the status filter to see all bookings."
                  : "Bookings will appear here once customers start booking."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr style={{ borderColor: "var(--border-default)" }}>
                    {[
                      "Ref",
                      "Status",
                      "Customer",
                      "Service",
                      "Date",
                      "Zone",
                      "Address",
                      "Keepers",
                      "Amount",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-xs font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const isSelected = selected?.id === b.id;
                    return (
                      <tr
                        key={b.id}
                        onClick={() => toggleSelected(b)}
                        className={[
                          "cursor-pointer transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-base-200/60",
                        ].join(" ")}
                      >
                        <td>
                          <span
                            className="font-mono text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {shortRef(b.id)}
                          </span>
                        </td>
                        <td>
                          <BookingStatusBadge status={b.status} />
                        </td>
                        <td>
                          <p
                            className="text-sm font-medium leading-tight"
                            style={{ color: "var(--text-strong)" }}
                          >
                            {b.customer.first_name} {b.customer.last_name}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {b.customer.phone}
                          </p>
                        </td>
                        <td>
                          <p
                            className="text-sm leading-tight"
                            style={{ color: "var(--text-body)" }}
                          >
                            {b.service.name}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {formatBedrooms(b.bedrooms)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          <p className="text-sm" style={{ color: "var(--text-body)" }}>
                            {formatDate(b.booking_date)}
                          </p>
                          {b.time_slot && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {b.time_slot}
                            </p>
                          )}
                        </td>
                        <td
                          className="text-sm"
                          style={{ color: "var(--text-body)" }}
                        >
                          {b.zone.name}
                        </td>
                        <td
                          className="text-sm max-w-[180px] truncate"
                          style={{ color: "var(--text-body)" }}
                        >
                          {b.address}
                        </td>
                        <td className="text-sm" style={{ color: "var(--text-body)" }}>
                          {tableCleanerLabel(b)}
                        </td>
                        <td
                          className="text-sm font-medium whitespace-nowrap"
                          style={{ color: "var(--text-strong)" }}
                        >
                          {formatNGN(b.total_amount_kobo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Page {page} of {pages} · {total} bookings
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-sm btn-ghost"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn btn-sm btn-ghost"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail panel ─────────────────────────────────────── */}
      {selected && (
        <div
          className="w-[380px] shrink-0 rounded-2xl overflow-y-auto sticky top-8"
          style={{
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-md)",
            maxHeight: "calc(100vh - 4rem)",
          }}
        >
          <BookingDetail
            booking={selected}
            onClose={() => setSelected(null)}
            onUpdated={refreshSelected}
          />
        </div>
      )}
    </div>
  );
}

/* ── Detail panel ───────────────────────────────────────────── */

function BookingDetail({
  booking: b,
  onClose,
  onUpdated,
}: {
  booking: Booking;
  onClose: () => void;
  onUpdated: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmIsError, setConfirmIsError] = useState(false);

  const [availableCleaners, setAvailableCleaners] = useState<AvailableCleaner[]>([]);
  const [loadingCleaners, setLoadingCleaners] = useState(false);
  // Per-role reassign state: keyed by "lead" | "second"
  const [selectedNewCleaner, setSelectedNewCleaner] = useState<Record<string, string>>({});
  const [reassigning, setReassigning] = useState<Record<string, boolean>>({});
  const [reassignMsg, setReassignMsg] = useState<Record<string, string | null>>({});
  const [reassignIsError, setReassignIsError] = useState<Record<string, boolean>>({});

  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg]   = useState<string | null>(null);
  const [cancelIsError, setCancelIsError] = useState(false);

  // Derive keeper list — prefer booking_cleaners, fall back to legacy cleaner field
  const keepers: BookingCleaner[] = (b.booking_cleaners ?? []).length > 0
    ? [...b.booking_cleaners].sort((a, x) =>
        a.role === "lead" ? -1 : x.role === "lead" ? 1 : 0,
      )
    : b.cleaner
    ? [{ id: "legacy", role: "lead", paid_out: false, transport_fare_kobo: null, cleaner: b.cleaner }]
    : [];

  const canConfirmDispatch =
    keepers.length > 0 &&
    ["matched", "paid"].includes(b.status);

  const canReassign = !["completed", "cancelled"].includes(b.status);
  const canCancel   = !["completed", "cancelled"].includes(b.status);

  useEffect(() => {
    if (!canReassign) return;
    setLoadingCleaners(true);
    setAvailableCleaners([]);
    setSelectedNewCleaner({});
    fetch(`/api/admin/bookings/${b.id}/available-cleaners`)
      .then((r) => r.json())
      .then((d) => setAvailableCleaners(d.cleaners ?? []))
      .catch(() => {})
      .finally(() => setLoadingCleaners(false));
  }, [b.id, canReassign]);

  async function handleConfirmDispatch() {
    const label =
      b.status === "confirmed"
        ? "Resend the dispatch email to the customer?"
        : `Confirm dispatch: flip status to Confirmed and notify "${b.customer.first_name}" via email?`;

    if (!window.confirm(label)) return;

    setConfirming(true);
    setConfirmMsg(null);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/confirm`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setConfirmIsError(false);
      setConfirmMsg("Confirmed. n8n notification triggered.");
      await onUpdated(b.id);
    } catch (err) {
      setConfirmIsError(true);
      setConfirmMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    const isPaid = ["paid", "confirmed"].includes(b.status);
    const msg = isPaid
      ? `Cancel this booking?\n\nPayment was already made (${b.paystack_reference ?? "ref unknown"}). You will need to issue a manual refund via Paystack. This does not do it automatically.\n\nAll cleaners' slots will be freed.`
      : `Cancel this booking?\n\nAll cleaners' slots will be freed and the booking marked as cancelled.`;
    if (!window.confirm(msg)) return;

    setCancelling(true);
    setCancelMsg(null);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/cancel`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setCancelIsError(false);
      setCancelMsg(
        d.refundRequired
          ? "Cancelled. Remember to issue the refund manually in Paystack."
          : "Booking cancelled and slot(s) freed.",
      );
      await onUpdated(b.id);
    } catch (err) {
      setCancelIsError(true);
      setCancelMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleReassign(role: "lead" | "second") {
    const newCleanerId = selectedNewCleaner[role];
    if (!newCleanerId) return;
    const newCleaner = availableCleaners.find((c) => c.id === newCleanerId);
    if (!newCleaner) return;

    const currentCleaner = keepers.find((k) => k.role === role)?.cleaner;
    const prev = currentCleaner
      ? `${currentCleaner.first_name} ${currentCleaner.last_name}`
      : "no one";
    const roleLabel = role === "lead" ? "Lead keeper" : "Second keeper";

    if (
      !window.confirm(
        `Reassign ${roleLabel}: ${prev} → ${newCleaner.first_name} ${newCleaner.last_name}?\n\nThe current keeper's availability slot will be freed and the new keeper's slot will be booked.`,
      )
    ) return;

    setReassigning((r) => ({ ...r, [role]: true }));
    setReassignMsg((m) => ({ ...m, [role]: null }));
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_cleaner_id: newCleanerId, role }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setReassignIsError((e) => ({ ...e, [role]: false }));
      setReassignMsg((m) => ({
        ...m,
        [role]: `Reassigned to ${newCleaner.first_name} ${newCleaner.last_name}.`,
      }));
      setSelectedNewCleaner((s) => ({ ...s, [role]: "" }));
      await onUpdated(b.id);
    } catch (err) {
      setReassignIsError((e) => ({ ...e, [role]: true }));
      setReassignMsg((m) => ({
        ...m,
        [role]: err instanceof Error ? err.message : "Something went wrong.",
      }));
    } finally {
      setReassigning((r) => ({ ...r, [role]: false }));
    }
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="font-mono text-xs mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            #{b.id}
          </p>
          <BookingStatusBadge status={b.status} />
          {(b.keeper_count ?? 1) >= 2 && (
            <span className="badge badge-xs badge-info badge-soft ml-2">2 keepers</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Close"
        >
          <XIcon />
        </button>
      </div>

      <div className="divide-y divide-base-200">
        {/* ── Actions ───────────────────────────────────────── */}
        {(canConfirmDispatch || canReassign || canCancel) && (
          <Section label="Actions">
            <div className="space-y-4">
              {/* Confirm dispatch */}
              {canConfirmDispatch && (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant={b.status === "confirmed" ? "secondary" : "primary"}
                    wide
                    loading={confirming}
                    onClick={handleConfirmDispatch}
                  >
                    {b.status === "confirmed"
                      ? "Resend dispatch email"
                      : "Confirm dispatch"}
                  </Button>
                  {confirmMsg && (
                    <p className={`text-xs ${confirmIsError ? "text-error" : "text-success"}`}>
                      {confirmMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Reassign keepers */}
              {canReassign && (
                <div className="space-y-3">
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Reassign keeper{keepers.length >= 2 ? "s" : ""}
                  </p>
                  {loadingCleaners ? (
                    <div className="flex items-center gap-2">
                      <Spinner size="xs" />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Finding available cleaners…
                      </span>
                    </div>
                  ) : availableCleaners.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                      No other active cleaners available for{" "}
                      {formatDate(b.booking_date)} in {b.zone.name}.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(keepers.length >= 2 ? ["lead", "second"] as const : ["lead"] as const).map((role) => {
                        const current = keepers.find((k) => k.role === role)?.cleaner;
                        const roleLabel = role === "lead" ? "Lead" : "Second";
                        return (
                          <div key={role} className="space-y-1.5">
                            {keepers.length >= 2 && (
                              <p className="text-xs font-semibold" style={{ color: "var(--text-subtle)" }}>
                                {roleLabel}
                                {current && (
                                  <span className="font-normal ml-1">
                                    (currently {current.first_name} {current.last_name})
                                  </span>
                                )}
                              </p>
                            )}
                            <select
                              value={selectedNewCleaner[role] ?? ""}
                              onChange={(e) =>
                                setSelectedNewCleaner((s) => ({ ...s, [role]: e.target.value }))
                              }
                              className="select select-sm w-full"
                            >
                              <option value="">Select cleaner…</option>
                              {availableCleaners.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.first_name} {c.last_name}
                                  {c.rating != null ? ` · ★ ${Number(c.rating).toFixed(1)}` : ""}
                                  {` · ${c.total_jobs} jobs`}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              wide
                              loading={reassigning[role] ?? false}
                              disabled={!selectedNewCleaner[role]}
                              onClick={() => handleReassign(role)}
                            >
                              {keepers.length >= 2 ? `Reassign ${roleLabel}` : "Reassign"}
                            </Button>
                            {reassignMsg[role] && (
                              <p className={`text-xs ${reassignIsError[role] ? "text-error" : "text-success"}`}>
                                {reassignMsg[role]}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Cancel booking */}
              {canCancel && (
                <div className="space-y-2 pt-2 border-t border-base-200">
                  <Button
                    size="sm"
                    variant="ghost"
                    wide
                    loading={cancelling}
                    onClick={handleCancel}
                    className="text-error hover:bg-error/10 border border-error/30"
                  >
                    Cancel booking
                  </Button>
                  {cancelMsg && (
                    <p className={`text-xs ${cancelIsError ? "text-error" : "text-success"}`}>
                      {cancelMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Customer */}
        <Section label="Customer">
          <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            {b.customer.first_name} {b.customer.last_name}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-body)" }}>
            {b.customer.phone}
          </p>
          {b.customer.email && (
            <p className="text-sm" style={{ color: "var(--text-body)" }}>
              {b.customer.email}
            </p>
          )}
        </Section>

        {/* Service */}
        <Section label="Service">
          <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            {b.service.name} · {formatBedrooms(b.bedrooms)}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-body)" }}>
            {formatDate(b.booking_date)}
            {b.time_slot && (
              <span
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--klova-accent-soft)", color: "var(--klova-primary)" }}
              >
                {b.time_slot}
              </span>
            )}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-body)" }}>
            {b.address}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {b.zone.name}
          </p>
        </Section>

        {/* Add-ons */}
        {b.booking_addons.length > 0 && (
          <Section label="Add-ons">
            <ul className="space-y-1">
              {b.booking_addons.map(({ addon }) => (
                <li
                  key={addon.id}
                  className="flex justify-between text-sm"
                  style={{ color: "var(--text-body)" }}
                >
                  <span>{addon.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {formatNGN(addon.amount_kobo)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Keepers — replaces old "Cleaner" section; handles 1 or 2 */}
        <Section label={keepers.length >= 2 ? "Keepers" : "Keeper"}>
          {keepers.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
              Not assigned
            </p>
          ) : (
            <div className="space-y-3">
              {keepers.map((bc) => {
                const c = bc.cleaner;
                if (!c) return null;
                return (
                  <div key={bc.id} className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-semibold"
                      style={{ background: "var(--surface-section)", color: "var(--text-muted)" }}
                    >
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${c.first_name[0]}${c.last_name[0]}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium flex items-center flex-wrap gap-1.5"
                        style={{ color: "var(--text-strong)" }}
                      >
                        {c.first_name} {c.last_name}
                        {c.nin_verified && (
                          <span className="badge badge-xs badge-success badge-soft">✓ Verified</span>
                        )}
                        {keepers.length >= 2 && (
                          <span className="badge badge-xs badge-ghost">
                            {bc.role === "lead" ? "Lead" : "2nd"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {c.phone}
                        {c.rating != null && ` · ★ ${Number(c.rating).toFixed(1)}`}
                        {` · ${c.total_jobs} jobs`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {bc.transport_fare_kobo != null && (
                          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                            Transport: {formatNGN(bc.transport_fare_kobo)}
                          </span>
                        )}
                        <span
                          className={`badge badge-xs ${bc.paid_out ? "badge-success badge-soft" : "badge-ghost"}`}
                        >
                          {bc.paid_out ? "Paid out" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Payment */}
        <Section label="Payment">
          <dl className="space-y-1.5">
            {b.paystack_reference && (
              <Row label="Reference">
                <span className="font-mono text-xs break-all" style={{ color: "var(--text-body)" }}>
                  {b.paystack_reference}
                </span>
              </Row>
            )}
            <Row label="Total">
              <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
                {formatNGN(b.total_amount_kobo)}
              </span>
            </Row>
            <Row label="Commission (22%)">
              <span style={{ color: "var(--text-body)" }}>{formatNGN(b.commission_kobo)}</span>
            </Row>
            {keepers.length >= 2 ? (
              // For 2-keeper bookings, show per-keeper payout split
              <>
                {keepers.map((bc) => {
                  const c = bc.cleaner;
                  const perKeeperPayout = Math.floor(
                    (b.total_amount_kobo - b.commission_kobo) / keepers.length,
                  );
                  return (
                    <Row key={bc.id} label={`${c?.first_name ?? "Keeper"} payout`}>
                      <span style={{ color: "var(--text-body)" }}>
                        {formatNGN(perKeeperPayout)}
                      </span>
                    </Row>
                  );
                })}
              </>
            ) : (
              <Row label="Cleaner payout">
                <span style={{ color: "var(--text-body)" }}>
                  {formatNGN(b.total_amount_kobo - b.commission_kobo)}
                </span>
              </Row>
            )}
          </dl>
        </Section>

        {/* Transport — only relevant once clean payment is confirmed */}
        {b.status === "confirmed" && (
          <TransportSection booking={b} keepers={keepers} onUpdated={onUpdated} />
        )}

        {/* Refund */}
        {b.refunded_at && (
          <Section label="Refund">
            <p className="text-sm text-error">
              Refunded {formatDateTime(b.refunded_at)}
            </p>
          </Section>
        )}

        {/* Meta */}
        <Section label="Timestamps">
          <dl className="space-y-1">
            <Row label="Created">
              <span style={{ color: "var(--text-body)" }}>{formatDateTime(b.created_at)}</span>
            </Row>
            <Row label="Updated">
              <span style={{ color: "var(--text-body)" }}>{formatDateTime(b.updated_at)}</span>
            </Row>
          </dl>
        </Section>
      </div>
    </div>
  );
}

/* ── Transport section ──────────────────────────────────────── */

const TRANSPORT_GATE_ALLOWED = new Set<TransportStatus>(["paid", "waived", "not_required"]);

const TRANSPORT_STATUS_CONFIG: Record<
  TransportStatus,
  { label: string; cls: string }
> = {
  pending_quote:    { label: "Pending quote",    cls: "badge-ghost" },
  awaiting_payment: { label: "Awaiting payment", cls: "badge-warning badge-soft" },
  paid:             { label: "Paid",             cls: "badge-success badge-soft" },
  waived:           { label: "Waived",           cls: "badge-info badge-soft" },
  not_required:     { label: "Not required",     cls: "badge-neutral badge-soft" },
};

function TransportStatusBadge({ status }: { status: TransportStatus }) {
  const { label, cls } =
    TRANSPORT_STATUS_CONFIG[status] ?? { label: status, cls: "badge-ghost" };
  return <span className={`badge badge-sm ${cls}`}>{label}</span>;
}

function hoursWaiting(since: string): string {
  const h = (Date.now() - new Date(since).getTime()) / (1000 * 60 * 60);
  return h < 1 ? "<1h" : `${Math.floor(h)}h`;
}

function formatNGNraw(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function TransportSection({
  booking: b,
  keepers,
  onUpdated,
}: {
  booking: Booking;
  keepers: BookingCleaner[];
  onUpdated: (id: string) => Promise<void>;
}) {
  const ts = b.transport_status ?? "pending_quote";
  const twoKeepers = keepers.length >= 2;

  // Per-keeper fare inputs (indexed 0=lead, 1=second)
  const [fareInputs, setFareInputs] = useState<string[]>(["", ""]);
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const [working, setWorking]       = useState(false);
  const [fareMsg, setFareMsg]       = useState<string | null>(null);
  const [fareErr, setFareErr]       = useState(false);

  const [resending, setResending]   = useState(false);
  const [resendMsg, setResendMsg]   = useState<string | null>(null);
  const [resendErr, setResendErr]   = useState(false);

  const [dispatching, setDispatching]   = useState(false);
  const [dispatchMsg, setDispatchMsg]   = useState<string | null>(null);
  const [dispatchErr, setDispatchErr]   = useState(false);

  const dispatchAllowed = TRANSPORT_GATE_ALLOWED.has(ts);
  const dispatchTooltip =
    ts === "pending_quote"
      ? "Quote, waive, or mark transport as not required first"
      : ts === "awaiting_payment"
      ? "Waiting for customer to pay the transport invoice"
      : null;

  useEffect(() => {
    if (ts !== "pending_quote" || !b.cleaner?.home_area) return;
    fetch(`/api/admin/bookings/${b.id}/transport-suggestion`)
      .then((r) => r.json())
      .then((d) => setSuggestion(typeof d.suggestion === "number" ? d.suggestion : null))
      .catch(() => {});
  }, [b.id, ts, b.cleaner?.home_area]);

  async function postFare(body: Record<string, unknown>, successMsg: string) {
    setWorking(true);
    setFareMsg(null);
    setFareErr(false);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/transport-fare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error?.message ?? d.error ?? "Request failed");
      setFareMsg(successMsg);
      await onUpdated(b.id);
    } catch (err) {
      setFareErr(true);
      setFareMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSetFareAndInvoice() {
    // Build the request body depending on 1 or 2 keepers
    let body: Record<string, unknown>;

    if (twoKeepers) {
      const amt0 = parseFloat(fareInputs[0]);
      const amt1 = parseFloat(fareInputs[1]);
      if (!Number.isFinite(amt0) || amt0 <= 0 || !Number.isFinite(amt1) || amt1 <= 0) {
        setFareErr(true);
        setFareMsg("Enter a valid fare for each keeper.");
        return;
      }
      body = { keeper_amounts: [amt0, amt1] };
    } else {
      const amount = parseFloat(fareInputs[0]);
      if (!Number.isFinite(amount) || amount <= 0) {
        setFareErr(true);
        setFareMsg("Enter a valid amount.");
        return;
      }
      body = { amount };
    }

    setWorking(true);
    setFareMsg("Setting fare…");
    setFareErr(false);
    try {
      const fareRes = await fetch(`/api/admin/bookings/${b.id}/transport-fare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const fareData = await fareRes.json().catch(() => ({}));
      if (!fareRes.ok)
        throw new Error(fareData.error?.message ?? fareData.error ?? "Failed to set fare");

      setFareMsg("Sending invoice…");

      const invRes = await fetch(`/api/admin/bookings/${b.id}/transport-invoice`, {
        method: "POST",
      });
      const invData = await invRes.json().catch(() => ({}));
      if (!invRes.ok)
        throw new Error(invData.error?.message ?? invData.error ?? "Failed to send invoice");

      setFareErr(false);
      setFareMsg("Invoice sent via Paystack ✓");
      setFareInputs(["", ""]);
      await onUpdated(b.id);
    } catch (err) {
      setFareErr(true);
      setFareMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  async function handleWaive() {
    if (
      !window.confirm(
        "Waive transport fare for this booking?\n\nNo keeper will receive transport reimbursement.",
      )
    ) return;
    await postFare({ waive: true }, "Transport fare waived.");
  }

  async function handleNotRequired() {
    if (
      !window.confirm(
        "Mark transport as not required?\n\nUse this for keepers who live nearby and don't need reimbursement.",
      )
    ) return;
    await postFare({ not_required: true }, "Transport marked as not required.");
  }

  async function handleResend() {
    setResending(true);
    setResendMsg(null);
    setResendErr(false);
    try {
      const r = await fetch(
        `/api/admin/bookings/${b.id}/transport-invoice/resend`,
        { method: "POST" },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error?.message ?? d.error ?? "Failed to resend");
      setResendMsg("Invoice resent via Paystack ✓");
    } catch (err) {
      setResendErr(true);
      setResendMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  }

  async function handleDispatch() {
    const keeperLabel = twoKeepers ? "both keepers" : "the keeper";
    if (
      !window.confirm(
        `Confirm dispatch for ${b.customer.first_name} ${b.customer.last_name}'s booking on ${formatDate(b.booking_date)}?\n\nThis sends the customer a "you're all set" SMS and tells ${keeperLabel} to head out.`,
      )
    ) return;
    setDispatching(true);
    setDispatchMsg(null);
    setDispatchErr(false);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/dispatch`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error?.message ?? d.error ?? "Dispatch failed");
      setDispatchMsg("Dispatched. Customer and Keeper(s) notified ✓");
      await onUpdated(b.id);
    } catch (err) {
      setDispatchErr(true);
      setDispatchMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDispatching(false);
    }
  }

  // Helper: fare input for one keeper slot
  function FareInput({
    index,
    label,
  }: {
    index: number;
    label?: string;
  }) {
    return (
      <div>
        {label && (
          <p className="text-xs mb-1" style={{ color: "var(--text-subtle)" }}>{label}</p>
        )}
        <div className="relative">
          <span
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          >
            ₦
          </span>
          <input
            type="number"
            min="1"
            max="5000"
            step="50"
            placeholder="0"
            value={fareInputs[index]}
            onChange={(e) =>
              setFareInputs((prev) => {
                const next = [...prev];
                next[index] = e.target.value;
                return next;
              })
            }
            onKeyDown={(e) => e.key === "Enter" && handleSetFareAndInvoice()}
            className="input input-sm w-full pl-6"
            disabled={working}
            style={{ appearance: "textfield" }}
          />
        </div>
      </div>
    );
  }

  const combinedFare = twoKeepers
    ? (parseFloat(fareInputs[0]) || 0) + (parseFloat(fareInputs[1]) || 0)
    : 0;

  return (
    <Section label="Transport">
      <div className="space-y-3">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <TransportStatusBadge status={ts} />
          {ts === "awaiting_payment" && b.transport_awaiting_since && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {hoursWaiting(b.transport_awaiting_since)} waiting
            </span>
          )}
        </div>

        {/* pending_quote: fare input(s) + actions */}
        {ts === "pending_quote" && (
          <div className="space-y-2">
            {twoKeepers ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <FareInput
                    index={0}
                    label={`Lead: ${keepers[0]?.cleaner?.first_name ?? "Keeper 1"}`}
                  />
                  <FareInput
                    index={1}
                    label={`2nd: ${keepers[1]?.cleaner?.first_name ?? "Keeper 2"}`}
                  />
                </div>
                {combinedFare > 0 && (
                  <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                    Combined invoice: {formatNGNraw(combinedFare)}
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-2 items-center">
                <FareInput index={0} />
                <button
                  className="btn btn-sm btn-primary whitespace-nowrap"
                  onClick={handleSetFareAndInvoice}
                  disabled={!fareInputs[0] || working}
                >
                  {working ? <Spinner size="xs" /> : "Send invoice"}
                </button>
              </div>
            )}

            {twoKeepers && (
              <button
                className="btn btn-sm btn-primary w-full"
                onClick={handleSetFareAndInvoice}
                disabled={!fareInputs[0] || !fareInputs[1] || working}
              >
                {working ? <Spinner size="xs" /> : "Send combined invoice"}
              </button>
            )}

            {suggestion != null && !twoKeepers && (
              <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                Suggested: {formatNGNraw(suggestion)}
              </p>
            )}

            <div className="flex gap-2 pt-0.5">
              <button className="btn btn-xs btn-ghost" onClick={handleWaive} disabled={working}>
                Waive
              </button>
              <button className="btn btn-xs btn-ghost" onClick={handleNotRequired} disabled={working}>
                Not required
              </button>
            </div>

            {fareMsg && (
              <p className={`text-xs ${fareErr ? "text-error" : "text-success"}`}>{fareMsg}</p>
            )}
          </div>
        )}

        {/* awaiting_payment: details + resend */}
        {ts === "awaiting_payment" && (
          <div className="space-y-2">
            <dl className="space-y-1.5">
              {b.transport_fare != null && (
                <Row label={twoKeepers ? "Combined fare" : "Fare"}>
                  <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
                    {formatNGNraw(b.transport_fare)}
                  </span>
                </Row>
              )}
              {twoKeepers && keepers.map((bc, i) => {
                if (bc.transport_fare_kobo == null) return null;
                const name = bc.cleaner?.first_name ?? `Keeper ${i + 1}`;
                return (
                  <Row key={bc.id} label={`${name} share`}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {formatNGN(bc.transport_fare_kobo)}
                    </span>
                  </Row>
                );
              })}
              {b.transport_payment_ref && (
                <Row label="Invoice ref">
                  <span className="font-mono text-xs break-all" style={{ color: "var(--text-muted)" }}>
                    {b.transport_payment_ref}
                  </span>
                </Row>
              )}
              {b.transport_awaiting_since && (
                <Row label="Sent">
                  <span style={{ color: "var(--text-body)" }}>
                    {formatDateTime(b.transport_awaiting_since)}
                  </span>
                </Row>
              )}
            </dl>
            <button
              className="btn btn-sm btn-outline w-full"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? <Spinner size="xs" /> : "Resend invoice"}
            </button>
            {resendMsg && (
              <p className={`text-xs ${resendErr ? "text-error" : "text-success"}`}>{resendMsg}</p>
            )}
          </div>
        )}

        {/* paid: receipt */}
        {ts === "paid" && (
          <dl className="space-y-1.5">
            {b.transport_fare != null && (
              <Row label={twoKeepers ? "Combined paid" : "Paid"}>
                <span className="font-semibold text-success">{formatNGNraw(b.transport_fare)}</span>
              </Row>
            )}
            {twoKeepers && keepers.map((bc, i) => {
              if (bc.transport_fare_kobo == null) return null;
              const name = bc.cleaner?.first_name ?? `Keeper ${i + 1}`;
              return (
                <Row key={bc.id} label={`${name} reimb.`}>
                  <span style={{ color: "var(--text-muted)" }}>
                    {formatNGN(bc.transport_fare_kobo)}
                  </span>
                </Row>
              );
            })}
            {b.transport_payment_ref && (
              <Row label="Ref">
                <span className="font-mono text-xs break-all" style={{ color: "var(--text-muted)" }}>
                  {b.transport_payment_ref}
                </span>
              </Row>
            )}
            {b.transport_paid_at && (
              <Row label="Paid at">
                <span style={{ color: "var(--text-body)" }}>{formatDateTime(b.transport_paid_at)}</span>
              </Row>
            )}
          </dl>
        )}

        {/* Dispatch gate */}
        <div className="pt-3 border-t border-base-200">
          {b.dispatched_at ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Dispatched {formatDateTime(b.dispatched_at)}
            </p>
          ) : (
            <>
              <div className="relative group" title={dispatchTooltip ?? undefined}>
                <button
                  className={[
                    "btn btn-sm w-full",
                    dispatchAllowed
                      ? "btn-primary"
                      : "btn-disabled opacity-50 cursor-not-allowed",
                  ].join(" ")}
                  onClick={dispatchAllowed ? handleDispatch : undefined}
                  disabled={!dispatchAllowed || dispatching}
                  aria-disabled={!dispatchAllowed}
                >
                  {dispatching ? <Spinner size="xs" /> : "Confirm dispatch"}
                </button>
                {!dispatchAllowed && dispatchTooltip && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 rounded-lg text-xs text-center pointer-events-none
                      opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    style={{
                      background: "var(--surface-section)",
                      color: "var(--text-body)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {dispatchTooltip}
                  </div>
                )}
              </div>
              {dispatchMsg && (
                <p className={`text-xs mt-1.5 ${dispatchErr ? "text-error" : "text-success"}`}>
                  {dispatchMsg}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ── Small layout helpers ───────────────────────────────────── */

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-4 first:pt-0">
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-2"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-4 text-sm">
      <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
