"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SERVICES, formatNGN } from "../data";
import type { ApiCleaner, ServiceSlug } from "../types";
import { SUPPORT_PHONE } from "@/lib/contact";
import { Button } from "@/components/ui/Button";
import { ConfirmNextSteps } from "../ConfirmNextSteps";

interface BookingSummary {
  booking_id: string;
  service: ServiceSlug | null;
  bedrooms: string | null;
  bookingDate: string | null;
  timeSlot: string | null;
  address: string;
  firstName: string;
  phone: string;
  email: string;
  serverTotal: number | null;
  cleaner: ApiCleaner | null;
}

export default function BookConfirmPage() {
  const [summary, setSummary] = useState<BookingSummary | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("klova_booking_summary");
      if (raw) setSummary(JSON.parse(raw) as BookingSummary);
      // Reset the in-progress booking id so the /book flow starts fresh, but keep
      // the summary so the confirmation (and keeper card) survives a page refresh.
      sessionStorage.removeItem("klova_booking_id");
    } catch {
      // session storage unavailable — show generic confirmation
    }
  }, []);

  // Clear the saved summary only when the customer actually leaves this screen.
  function clearSummary() {
    try {
      sessionStorage.removeItem("klova_booking_summary");
    } catch {
      // ignore
    }
  }

  const service = SERVICES.find((s) => s.slug === summary?.service);

  const bookingDate = summary?.bookingDate
    ? new Date(summary.bookingDate + "T00:00:00").toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-12">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: "var(--klova-primary-soft)" }}
        >
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: "var(--klova-primary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
          You&apos;re all set!
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Payment received. Your booking is on its way to being confirmed.
        </p>
      </div>

      <ConfirmNextSteps email={summary?.email} className="mb-6" />

      {/* Booking card */}
      {summary && (
        <div
          className="rounded-2xl border text-sm mb-6 overflow-hidden"
          style={{ borderColor: "var(--border-default)", background: "var(--surface-card)" }}
        >
          <div className="px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
              Booking details
            </p>
            <div className="space-y-2">
              {service && <ConfRow label="Service">{service.name}</ConfRow>}
              {summary.bedrooms && (
                <ConfRow label="Size">
                  {summary.bedrooms} bedroom{summary.bedrooms === "1" ? "" : "s"}
                </ConfRow>
              )}
              {bookingDate && <ConfRow label="Date">{bookingDate}</ConfRow>}
              {summary.timeSlot && <ConfRow label="Arrival">{summary.timeSlot}</ConfRow>}
              {summary.address && <ConfRow label="Address">{summary.address}</ConfRow>}
              {summary.serverTotal !== null && (
                <ConfRow label="Paid">
                  <span style={{ color: "var(--klova-accent)", fontWeight: 700 }}>
                    {formatNGN(summary.serverTotal)}
                  </span>
                </ConfRow>
              )}
            </div>
          </div>

          {summary.cleaner && (
            <div
              className="px-5 py-4"
              style={{ borderTop: "1px solid var(--border-default)" }}
            >
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
                Your keeper
              </p>
              <div className="flex items-center gap-3">
                {summary.cleaner.photo_url ? (
                  <img
                    src={summary.cleaner.photo_url}
                    alt={summary.cleaner.first_name}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg shrink-0"
                    style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
                  >
                    {summary.cleaner.first_name[0]}{summary.cleaner.last_name[0]}
                  </div>
                )}
                <div>
                  <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
                    {summary.cleaner.first_name} {summary.cleaner.last_name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"
                      style={{ color: "var(--klova-accent)" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {summary.cleaner.rating.toFixed(1)} · {summary.cleaner.total_jobs} jobs · Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/" className="w-full" onClick={clearSummary}>
          <Button variant="primary" className="w-full">Back to home</Button>
        </Link>
        <p className="text-xs text-center" style={{ color: "var(--text-subtle)" }}>
          Questions? WhatsApp us at{" "}
          <a href={`https://wa.me/${SUPPORT_PHONE}`} className="underline" target="_blank" rel="noopener">
            WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

function ConfRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--text-body)" }}>{children}</span>
    </div>
  );
}
