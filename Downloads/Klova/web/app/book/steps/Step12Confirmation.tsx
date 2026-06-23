"use client";

import Link from "next/link";
import type { BookingData } from "../types";
import type { PriceBreakdown } from "../types";
import { SERVICES, formatNGN } from "../data";
import { SUPPORT_PHONE } from "@/lib/contact";
import { Button } from "@/components/ui/Button";
import { ConfirmNextSteps } from "../ConfirmNextSteps";
import { Section, SoftCard, Field } from "../confirmUI";

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

      <div className="space-y-7">
        <ConfirmNextSteps email={data.email} keeperCount={data.keeperCount} />

        <Section title="Booking details">
          <SoftCard>
            <div className="space-y-5">
              <Field label="Service">{service?.name}</Field>
              {data.keeperCount >= 2 && (
                <Field label="Keepers">2 keepers · base price doubled, add-ons shared</Field>
              )}
              <Field label="Address">{data.address}</Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date">{bookingDate}</Field>
                <Field label="Arrival">{data.timeSlot}</Field>
              </div>
            </div>
          </SoftCard>
        </Section>

        <Section title={data.keeperCount >= 2 ? "Your keepers" : "Your keeper"}>
          <SoftCard>
            {data.keeperCount >= 2 ? (
              <div className="flex items-center gap-4">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--klova-primary-soft)" }}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                      style={{ color: "var(--klova-primary)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                ))}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>2 Verified Keepers</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Full details sent to {data.email || "your email"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--klova-primary-soft)" }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                    style={{ color: "var(--klova-primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>Verified Keeper</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Full details sent to {data.email || "your email"}
                  </p>
                </div>
              </div>
            )}
          </SoftCard>
        </Section>

        <Section title="Payment">
          <SoftCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-medium" style={{ color: "var(--text-strong)" }}>Total paid</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>Paid securely via Paystack</p>
              </div>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--klova-accent)" }}>
                {formatNGN(price.monthlyTotal)}
              </p>
            </div>
          </SoftCard>
        </Section>
      </div>

      <div className="flex flex-col gap-3 mt-8">
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
