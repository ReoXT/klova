"use client";

import Link from "next/link";
import type { BookingData } from "../types";
import type { PriceBreakdown } from "../types";
import { SERVICES, formatNGN } from "../data";
import { SUPPORT_PHONE } from "@/lib/contact";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TransportNote } from "../TransportNote";

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

      <Alert variant="success" title="Booking confirmed" className="mb-6">
        <p>
          Order updates and your full receipt will be sent to{" "}
          <strong>{data.email || "your email"}</strong>.
          Your keeper will be in touch before arrival.
        </p>
      </Alert>

      <TransportNote className="mb-6" />

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

        {/* Keeper — details confirmed post-payment via /book/confirm */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
            Your keeper
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--klova-primary-soft)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                style={{ color: "var(--klova-primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>Verified Keeper</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Full details sent to {data.email || "your email"}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Reminder */}
      <Alert variant="warning" title="Before your keeper arrives" className="mb-6">
        Please have a broom, mop, bin liners, cleaning sprays and gloves ready at home, your keeper brings no equipment.
      </Alert>

      <div className="flex flex-col gap-3">
        <Link href="/" className="w-full">
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
    <div className="flex justify-between gap-2">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--text-body)" }}>{children}</span>
    </div>
  );
}
