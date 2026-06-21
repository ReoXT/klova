"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SERVICES, formatNGN } from "../data";
import type { ApiCleaner, ServiceSlug } from "../types";
import { SUPPORT_PHONE } from "@/lib/contact";
import { Button } from "@/components/ui/Button";
import { KeeperCard } from "@/components/ui/KeeperCard";
import { ConfirmNextSteps } from "../ConfirmNextSteps";
import { Section, SoftCard, Field, Pill } from "../confirmUI";

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
  cleaners: ApiCleaner[];
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
  const keepers = summary?.cleaners ?? [];

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

      <div className="space-y-7">
        <ConfirmNextSteps email={summary?.email} />

        {summary && (
          <Section title="Booking details">
            <SoftCard>
              <div className="space-y-5">
                {service && <Field label="Service">{service.name}</Field>}
                {summary.bedrooms && (
                  <Field label="Home size">
                    <Pill>
                      {summary.bedrooms} bedroom{summary.bedrooms === "1" ? "" : "s"}
                    </Pill>
                  </Field>
                )}
                {summary.address && <Field label="Address">{summary.address}</Field>}
                {(bookingDate || summary.timeSlot) && (
                  <div className="grid grid-cols-2 gap-4">
                    {bookingDate && <Field label="Date">{bookingDate}</Field>}
                    {summary.timeSlot && <Field label="Arrival">{summary.timeSlot}</Field>}
                  </div>
                )}
              </div>
            </SoftCard>
          </Section>
        )}

        {keepers.length > 0 && (
          <Section title={keepers.length === 1 ? "Your keeper" : "Your keepers"}>
            <div className={keepers.length === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : undefined}>
              {keepers.map((c) => (
                <KeeperCard
                  key={c.id}
                  firstName={c.first_name}
                  photoUrl={c.photo_url}
                  rating={c.rating}
                  totalJobs={c.total_jobs}
                />
              ))}
            </div>
          </Section>
        )}

        {summary?.serverTotal != null && (
          <Section title="Payment">
            <SoftCard>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-medium" style={{ color: "var(--text-strong)" }}>Total paid</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>Paid securely via Paystack</p>
                </div>
                <p className="text-xl font-bold tabular-nums" style={{ color: "var(--klova-accent)" }}>
                  {formatNGN(summary.serverTotal)}
                </p>
              </div>
            </SoftCard>
          </Section>
        )}
      </div>

      <div className="flex flex-col gap-3 mt-8">
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
