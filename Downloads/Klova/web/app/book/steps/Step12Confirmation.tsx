"use client";

import Link from "next/link";
import type { BookingData } from "../types";
import type { PriceBreakdown } from "../types";
import { SERVICES, FAKE_KEEPER, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Props {
  data: BookingData;
  price: PriceBreakdown;
}

export default function Step12Confirmation({ data, price }: Props) {
  const service = SERVICES.find((s) => s.slug === data.service);
  const bookingRef = `KLV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const bookingDate = data.bookingDate
    ? new Date(data.bookingDate + "T00:00:00").toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-8">
      {/* Confirmation hero */}
      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: "var(--klova-primary-soft)" }}
        >
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "var(--klova-primary)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
          You&apos;re all set!
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Your booking is confirmed. Reference:{" "}
          <span className="font-semibold" style={{ color: "var(--text-body)" }}>{bookingRef}</span>
        </p>
      </div>

      <Alert variant="success" className="mb-6">
        <p>
          <strong>You&apos;ll get a confirmation SMS</strong> to {data.phone} shortly. Check your email at{" "}
          {data.email} for the full booking receipt.
        </p>
      </Alert>

      {/* Booking card */}
      <div
        className="rounded-2xl border divide-y text-sm mb-6"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-card)" }}
      >
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
            Booking details
          </p>
          <div className="space-y-2">
            <ConfRow label="Service">{service?.name}</ConfRow>
            <ConfRow label="Date">{bookingDate}</ConfRow>
            <ConfRow label="Time">{data.timeSlot}</ConfRow>
            <ConfRow label="Address">{data.address}</ConfRow>
            <ConfRow label="Paid">{formatNGN(price.monthlyTotal)}</ConfRow>
          </div>
        </div>

        {/* Keeper */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
            Your keeper
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-semibold shrink-0"
              style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
            >
              {FAKE_KEEPER.firstName[0]}{FAKE_KEEPER.lastName[0]}
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
                {FAKE_KEEPER.firstName} {FAKE_KEEPER.lastName}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--klova-accent)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {FAKE_KEEPER.rating} · {FAKE_KEEPER.totalJobs} jobs · NIN Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reminder */}
      <Alert variant="warning" className="mb-6">
        <strong>Reminder:</strong> Please have your cleaning supplies ready before your keeper arrives — broom, mop, bin liners, cleaning sprays and gloves.
      </Alert>

      <div className="flex flex-col gap-3">
        <Link href="/" className="w-full">
          <Button variant="primary" className="w-full">Back to home</Button>
        </Link>
        <p className="text-xs text-center" style={{ color: "var(--text-subtle)" }}>
          Questions? WhatsApp us at{" "}
          <a href="https://wa.me/2348000000000" className="underline" target="_blank" rel="noopener">
            +234 800 000 0000
          </a>
        </p>
      </div>
    </div>
  );
}

function ConfRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--text-body)" }}>{children}</span>
    </div>
  );
}
