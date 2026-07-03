"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { KeeperCard } from "@/components/ui/KeeperCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Section, SoftCard, Field } from "../../confirmUI";
import { formatNGN } from "../../data";
import { SUPPORT_PHONE } from "@/lib/contact";
import type { ApiCleaner } from "../../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

interface BookingStatus {
  id: string;
  status: string;
  keeper_count: number;
  transport_status: string;
  transport_fare: number | null;
  transport_payment_ref: string | null;
  service_name: string | null;
  booking_date: string | null;
  address: string | null;
  first_name: string | null;
  total_amount: number | null;
  cleaners: ApiCleaner[];
}

// ─── State sub-components ─────────────────────────────────────────────────────

function PendingQuoteState({ keeperCount }: { keeperCount: number }) {
  const two = keeperCount >= 2;
  return (
    <SoftCard>
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "var(--klova-accent-soft)" }}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "var(--klova-accent)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
            Calculating your transport fare
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {two
              ? "We're getting a combined transport estimate for your two keepers. You'll receive a Paystack payment link shortly by SMS."
              : "We're getting a transport estimate for your keeper. You'll receive a Paystack payment link shortly by SMS."}
          </p>
        </div>
      </div>
    </SoftCard>
  );
}

function AwaitingPaymentState({
  fare,
  payRef,
  keeperCount,
}: {
  fare: number;
  payRef: string | null;
  keeperCount: number;
}) {
  const two = keeperCount >= 2;
  const payUrl = payRef ? `https://paystack.com/pay/${payRef}` : null;

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border-2 p-6"
        style={{ borderColor: "var(--klova-accent)", background: "var(--surface-card)" }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--klova-accent-soft)" }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "var(--klova-accent)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-0.5" style={{ color: "var(--text-strong)" }}>
              Transport fare: {formatNGN(fare)}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {two
                ? "Combined transport for your two keepers. Pay once to confirm their dispatch."
                : "Transport for your keeper. Pay to confirm dispatch."}
            </p>
          </div>
        </div>

        {payUrl ? (
          <a href={payUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button variant="primary" className="w-full">
              Pay {formatNGN(fare)} now
            </Button>
          </a>
        ) : (
          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            Check your email or SMS for the Paystack payment link.
          </p>
        )}

        {payRef && (
          <p className="text-xs text-center mt-3" style={{ color: "var(--text-subtle)" }}>
            Can&apos;t click? Use bank transfer with reference{" "}
            <span className="font-semibold" style={{ color: "var(--text-body)" }}>{payRef}</span>.
          </p>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: "var(--text-subtle)" }}>
        {two ? "Your keepers" : "Your keeper"} will be dispatched as soon as the fare is cleared.
      </p>
    </div>
  );
}

function DispatchClearedState({
  cleaners,
  keeperCount,
}: {
  cleaners: ApiCleaner[];
  keeperCount: number;
}) {
  const two = keeperCount >= 2;
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "var(--klova-success-soft, #dcfce7)" }}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            style={{ color: "var(--klova-success, #16a34a)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
          {two ? "Your keepers are on the way!" : "Your keeper is on the way!"}
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Transport confirmed.{" "}
          {two ? "Your keepers" : "Your keeper"} will be in touch before arrival.
        </p>
      </div>

      <div className={two ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "max-w-sm mx-auto"}>
        {cleaners.map((c) => (
          <KeeperCard
            key={c.id}
            firstName={c.first_name}
            photoUrl={c.photo_url}
            rating={c.rating}
            totalJobs={c.total_jobs}
          />
        ))}
      </div>
    </div>
  );
}

function CancelledState() {
  return (
    <EmptyState
      icon={
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      heading="Booking cancelled"
      message="This booking was cancelled. If you paid for the cleaning, a refund has been issued to your original payment method. Allow 3–5 business days."
    />
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingStatusPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/bookings/${id}/status`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json() as Promise<{ ok: boolean; data: BookingStatus }>;
      })
      .then((json) => {
        if (!json) return;
        if (json.ok) setBooking(json.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" style={{ color: "var(--klova-primary)" }} />
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16">
        <EmptyState
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          }
          heading="Booking not found"
          message="We couldn't find a booking with that reference. Check the link in your SMS or email."
          action={{ label: "Back to home", href: "/" }}
        />
      </div>
    );
  }

  const two = booking.keeper_count >= 2;
  const isCancelled = booking.status === "cancelled" || booking.status === "no_match";
  const dispatchCleared = ["paid", "waived", "not_required"].includes(booking.transport_status);
  const bookingDate = booking.booking_date ? formatDate(booking.booking_date) : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-12">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
          {isCancelled
            ? "Booking cancelled"
            : dispatchCleared
            ? two
              ? "Your keepers are on the way"
              : "Your keeper is on the way"
            : "Booking confirmed"}
        </h1>
        {booking.first_name && !isCancelled && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Hi {booking.first_name}, here&apos;s your live booking status.
          </p>
        )}
      </div>

      <div className="space-y-7">
        {/* Primary status section */}
        {isCancelled ? (
          <CancelledState />
        ) : dispatchCleared ? (
          <Section title={two ? "Your keepers" : "Your keeper"}>
            <DispatchClearedState cleaners={booking.cleaners} keeperCount={booking.keeper_count} />
          </Section>
        ) : booking.transport_status === "awaiting_payment" && booking.transport_fare != null ? (
          <Section title="Action required">
            <AwaitingPaymentState
              fare={booking.transport_fare}
              payRef={booking.transport_payment_ref}
              keeperCount={booking.keeper_count}
            />
          </Section>
        ) : (
          <Section title="Transport fare">
            <PendingQuoteState keeperCount={booking.keeper_count} />
          </Section>
        )}

        {/* Booking details */}
        {!isCancelled && (
          <Section title="Booking details">
            <SoftCard>
              <div className="space-y-5">
                {booking.service_name && (
                  <Field label="Service">{booking.service_name}</Field>
                )}
                {two && (
                  <Field label="Keepers">2 keepers · base price doubled, add-ons shared</Field>
                )}
                {booking.address && (
                  <Field label="Address">{booking.address}</Field>
                )}
                {bookingDate && (
                  <Field label="Date">{bookingDate}</Field>
                )}
                {booking.total_amount != null && (
                  <Field label="Clean paid">{formatNGN(booking.total_amount)}</Field>
                )}
              </div>
            </SoftCard>
          </Section>
        )}

        {/* Support */}
        <p className="text-xs text-center" style={{ color: "var(--text-subtle)" }}>
          Questions?{" "}
          {SUPPORT_PHONE ? (
            <a
              href={`https://wa.me/${SUPPORT_PHONE}`}
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp us
            </a>
          ) : (
            "Contact our support team."
          )}
          {isCancelled && (
            <>
              {" "}
              <Link href="/book" className="underline">
                Book again
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
