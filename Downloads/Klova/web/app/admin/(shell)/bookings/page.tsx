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

type Booking = {
  id: string;
  bedrooms: string;
  booking_date: string;
  address: string;
  total_amount_kobo: number;
  commission_kobo: number;
  status: BookingStatus;
  paystack_reference: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
  };
  cleaner: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    photo_url: string | null;
    nin_verified: boolean;
    rating: number | null;
    total_jobs: number;
  } | null;
  zone: { id: string; name: string; slug: string };
  service: { id: string; name: string; slug: string };
  booking_addons: Array<{
    addon: { id: string; name: string; slug: string; amount_kobo: number };
  }>;
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
  { key: null,              label: "All" },
  { key: "pending_payment", label: "Awaiting Payment" },
  { key: "matched",         label: "Matched" },
  { key: "paid",            label: "Paid" },
  { key: "confirmed",       label: "Confirmed" },
  { key: "completed",       label: "Completed" },
  { key: "cancelled",       label: "Cancelled" },
  { key: "no_match",        label: "No Match" },
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
                      "Cleaner",
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
                        <td
                          className="text-sm whitespace-nowrap"
                          style={{ color: "var(--text-body)" }}
                        >
                          {formatDate(b.booking_date)}
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
                        <td
                          className="text-sm"
                          style={{
                            color: b.cleaner
                              ? "var(--text-body)"
                              : "var(--text-subtle)",
                          }}
                        >
                          {b.cleaner
                            ? `${b.cleaner.first_name} ${b.cleaner.last_name[0]}.`
                            : "—"}
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
          className="w-[360px] shrink-0 rounded-2xl overflow-y-auto sticky top-8"
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
  const [selectedNewCleaner, setSelectedNewCleaner] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState<string | null>(null);
  const [reassignIsError, setReassignIsError] = useState(false);

  const canConfirmDispatch =
    b.cleaner !== null &&
    ["matched", "paid", "confirmed"].includes(b.status);

  const canReassign = !["completed", "cancelled"].includes(b.status);

  // Fetch available cleaners whenever this booking is shown and reassign is relevant
  useEffect(() => {
    if (!canReassign) return;
    setLoadingCleaners(true);
    setAvailableCleaners([]);
    setSelectedNewCleaner("");
    fetch(`/api/admin/bookings/${b.id}/available-cleaners`)
      .then((r) => r.json())
      .then((d) => setAvailableCleaners(d.cleaners ?? []))
      .catch(() => {})
      .finally(() => setLoadingCleaners(false));
  }, [b.id, canReassign]);

  async function handleConfirmDispatch() {
    const label =
      b.status === "confirmed"
        ? "Resend the dispatch SMS to the customer?"
        : `Confirm dispatch — flip status to Confirmed and send "${b.customer.first_name}" the you're-all-set SMS?`;

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
      setConfirmMsg("Confirmed — n8n notification triggered.");
      await onUpdated(b.id);
    } catch (err) {
      setConfirmIsError(true);
      setConfirmMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleReassign() {
    if (!selectedNewCleaner) return;
    const newCleaner = availableCleaners.find((c) => c.id === selectedNewCleaner);
    if (!newCleaner) return;

    const prev = b.cleaner
      ? `${b.cleaner.first_name} ${b.cleaner.last_name}`
      : "no one";

    if (
      !window.confirm(
        `Reassign from ${prev} → ${newCleaner.first_name} ${newCleaner.last_name}?\n\nThe current cleaner's availability slot will be freed and the new cleaner's slot will be booked.`,
      )
    )
      return;

    setReassigning(true);
    setReassignMsg(null);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_cleaner_id: selectedNewCleaner }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setReassignIsError(false);
      setReassignMsg(
        `Reassigned to ${newCleaner.first_name} ${newCleaner.last_name}.`,
      );
      setSelectedNewCleaner("");
      await onUpdated(b.id);
    } catch (err) {
      setReassignIsError(true);
      setReassignMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReassigning(false);
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
        {(canConfirmDispatch || canReassign) && (
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
                      ? "Resend dispatch SMS"
                      : "Confirm dispatch"}
                  </Button>
                  {confirmMsg && (
                    <p
                      className={`text-xs ${confirmIsError ? "text-error" : "text-success"}`}
                    >
                      {confirmMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Reassign cleaner */}
              {canReassign && (
                <div className="space-y-2">
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Reassign cleaner
                  </p>
                  {loadingCleaners ? (
                    <div className="flex items-center gap-2">
                      <Spinner size="xs" />
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Finding available cleaners…
                      </span>
                    </div>
                  ) : availableCleaners.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                      No other active cleaners available for{" "}
                      {formatDate(b.booking_date)} in {b.zone.name}.
                    </p>
                  ) : (
                    <>
                      <select
                        value={selectedNewCleaner}
                        onChange={(e) => setSelectedNewCleaner(e.target.value)}
                        className="select select-sm w-full"
                      >
                        <option value="">Select cleaner…</option>
                        {availableCleaners.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                            {c.rating != null
                              ? ` · ★ ${Number(c.rating).toFixed(1)}`
                              : ""}
                            {` · ${c.total_jobs} jobs`}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        wide
                        loading={reassigning}
                        disabled={!selectedNewCleaner}
                        onClick={handleReassign}
                      >
                        Reassign
                      </Button>
                    </>
                  )}
                  {reassignMsg && (
                    <p
                      className={`text-xs ${reassignIsError ? "text-error" : "text-success"}`}
                    >
                      {reassignMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Customer */}
        <Section label="Customer">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-strong)" }}
          >
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
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-strong)" }}
          >
            {b.service.name} · {formatBedrooms(b.bedrooms)}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-body)" }}>
            {formatDate(b.booking_date)}
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

        {/* Cleaner */}
        <Section label="Cleaner">
          {b.cleaner ? (
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-semibold"
                style={{
                  background: "var(--surface-section)",
                  color: "var(--text-muted)",
                }}
              >
                {b.cleaner.photo_url ? (
                  <img
                    src={b.cleaner.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  `${b.cleaner.first_name[0]}${b.cleaner.last_name[0]}`
                )}
              </div>
              <div>
                <p
                  className="text-sm font-medium flex items-center gap-1.5"
                  style={{ color: "var(--text-strong)" }}
                >
                  {b.cleaner.first_name} {b.cleaner.last_name}
                  {b.cleaner.nin_verified && (
                    <span className="badge badge-xs badge-success badge-soft">
                      NIN ✓
                    </span>
                  )}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {b.cleaner.phone}
                  {b.cleaner.rating != null &&
                    ` · ★ ${Number(b.cleaner.rating).toFixed(1)}`}
                  {` · ${b.cleaner.total_jobs} jobs`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
              Not assigned
            </p>
          )}
        </Section>

        {/* Payment */}
        <Section label="Payment">
          <dl className="space-y-1.5">
            {b.paystack_reference && (
              <Row label="Reference">
                <span
                  className="font-mono text-xs break-all"
                  style={{ color: "var(--text-body)" }}
                >
                  {b.paystack_reference}
                </span>
              </Row>
            )}
            <Row label="Total">
              <span
                className="font-semibold"
                style={{ color: "var(--text-strong)" }}
              >
                {formatNGN(b.total_amount_kobo)}
              </span>
            </Row>
            <Row label="Commission (22%)">
              <span style={{ color: "var(--text-body)" }}>
                {formatNGN(b.commission_kobo)}
              </span>
            </Row>
            <Row label="Cleaner payout">
              <span style={{ color: "var(--text-body)" }}>
                {formatNGN(b.total_amount_kobo - b.commission_kobo)}
              </span>
            </Row>
          </dl>
        </Section>

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
              <span style={{ color: "var(--text-body)" }}>
                {formatDateTime(b.created_at)}
              </span>
            </Row>
            <Row label="Updated">
              <span style={{ color: "var(--text-body)" }}>
                {formatDateTime(b.updated_at)}
              </span>
            </Row>
          </dl>
        </Section>
      </div>
    </div>
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
