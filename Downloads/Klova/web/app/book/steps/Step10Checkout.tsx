"use client";

import { useState } from "react";
import type { BookingData, PriceBreakdown } from "../types";
import { INSURANCE_FEE, PROMO_CODES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

export default function Step10Checkout({ data, patch, price, onNext, onBack }: Props) {
  const [promoInput, setPromoInput] = useState(data.promoCode);
  const [promoStatus, setPromoStatus] = useState<"idle" | "ok" | "invalid">("idle");
  const [showOptOutModal, setShowOptOutModal] = useState(false);
  const [showInsuranceDetails, setShowInsuranceDetails] = useState(false);

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code] !== undefined) {
      patch({ promoCode: code });
      setPromoStatus("ok");
    } else {
      patch({ promoCode: "" });
      setPromoStatus("invalid");
    }
  }

  function handleInsuranceClick() {
    if (data.wantsInsurance) {
      setShowOptOutModal(true);
    } else {
      patch({ wantsInsurance: true });
    }
  }

  const monthOptions = [
    { months: 1, label: "1 month (this booking only)", description: null },
    { months: 2, label: "2 months", description: `Pay upfront for 2 visits — ${formatNGN(price.total * 2)}` },
    { months: 3, label: "3 months", description: `Pay upfront for 3 visits — ${formatNGN(price.total * 3)}` },
  ];

  const grandTotal = price.monthlyTotal;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Checkout
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Review and customise your payment.
      </p>

      {/* Multi-month */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-body)" }}>
          Pay for multiple months upfront
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Lock in your keeper for upcoming months. Max 3 months.
        </p>
        <div className="flex flex-col gap-2.5">
          {monthOptions.map(({ months, label, description }) => {
            const sel = data.payMonths === months;
            return (
              <button
                key={months}
                type="button"
                onClick={() => patch({ payMonths: months })}
                className="w-full text-left rounded-xl border-2 px-4 py-3 flex items-center gap-3 transition-all duration-150"
                style={{
                  borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                  background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: sel ? "var(--klova-accent)" : "var(--border-strong)" }}
                >
                  {sel && <div className="w-2 h-2 rounded-full" style={{ background: "var(--klova-accent)" }} />}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: sel ? "var(--klova-primary)" : "var(--text-strong)" }}>
                    {label}
                  </p>
                  {description && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Booking insurance */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleInsuranceClick}
          className="w-full text-left rounded-xl border-2 px-4 py-4 flex items-start gap-3 transition-all duration-150"
          style={{
            borderColor: data.wantsInsurance ? "var(--klova-accent)" : "var(--border-default)",
            background: data.wantsInsurance ? "var(--klova-accent-soft)" : "var(--surface-card)",
          }}
        >
          <div
            className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5"
            style={{
              borderColor: data.wantsInsurance ? "var(--klova-accent)" : "var(--border-strong)",
              background: data.wantsInsurance ? "var(--klova-accent)" : "transparent",
            }}
          >
            {data.wantsInsurance && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p
              className="font-semibold text-sm"
              style={{ color: data.wantsInsurance ? "var(--klova-primary)" : "var(--text-strong)" }}
            >
              Booking insurance — {formatNGN(INSURANCE_FEE)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Protection against stolen or damaged items during your clean. Covers up to ₦200,000.
            </p>
          </div>
        </button>
      </div>

      {/* Promo code */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2" style={{ color: "var(--text-body)" }}>
          Promotional code
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter code"
            value={promoInput}
            onChange={(e) => {
              setPromoInput(e.target.value.toUpperCase());
              setPromoStatus("idle");
            }}
            className={["input flex-1 text-sm", promoStatus === "invalid" ? "input-error" : ""].filter(Boolean).join(" ")}
          />
          <Button variant="outline" size="sm" onClick={applyPromo} className="px-4">
            Apply
          </Button>
        </div>
        {promoStatus === "ok" && (
          <p className="text-xs text-success mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Code applied — {PROMO_CODES[data.promoCode]}% off!
          </p>
        )}
        {promoStatus === "invalid" && (
          <p className="text-xs text-error mt-1">That code isn&apos;t valid or has expired.</p>
        )}
      </div>

      {/* Price summary */}
      <div
        className="rounded-2xl border divide-y text-sm mb-6"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="px-4 py-3 flex justify-between">
          <span style={{ color: "var(--text-muted)" }}>
            {data.payMonths > 1
              ? `${data.payMonths} visits × ${formatNGN(price.base + price.keeperSurcharge + price.extras)}`
              : "Subtotal"}
          </span>
          <span style={{ color: "var(--text-body)" }}>
            {formatNGN((price.base + price.keeperSurcharge + price.extras) * data.payMonths)}
          </span>
        </div>
        {price.discount > 0 && (
          <div className="px-4 py-3 flex justify-between">
            <span style={{ color: "var(--klova-success)" }}>Discount ({PROMO_CODES[data.promoCode]}%)</span>
            <span style={{ color: "var(--klova-success)" }}>−{formatNGN(price.discount * data.payMonths)}</span>
          </div>
        )}
        {price.insurance > 0 && (
          <div className="px-4 py-3 flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Insurance (one-time)</span>
            <span style={{ color: "var(--text-body)" }}>{formatNGN(price.insurance)}</span>
          </div>
        )}
        <div className="px-4 py-3 flex justify-between font-semibold">
          <span style={{ color: "var(--text-strong)" }}>You pay</span>
          <span className="text-base" style={{ color: "var(--klova-accent)" }}>{formatNGN(grandTotal)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={onNext} className="flex-1">
          Find my keeper →
        </Button>
      </div>

      {/* Insurance opt-out modal */}
      {showOptOutModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowOptOutModal(false); }}
        >
          <div
            className="rounded-2xl w-full max-w-sm p-6"
            style={{
              background: "var(--surface-card)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            {/* Shield icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "oklch(0.68 0.14 67 / 0.15)" }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                style={{ color: "oklch(0.55 0.12 67)" }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold text-center mb-3" style={{ color: "var(--text-strong)" }}>
              Are you sure?
            </h2>

            <p className="text-sm mb-3" style={{ color: "var(--text-body)" }}>
              Klova Keepers are NIN-verified and thoroughly vetted — but life is unpredictable. For just{" "}
              <strong>{formatNGN(INSURANCE_FEE)}</strong>, booking insurance protects you for stolen or
              damaged items up to <strong>₦200,000</strong>.
            </p>

            <p className="text-sm mb-3" style={{ color: "var(--text-body)" }}>
              Without insurance, Klova cannot be held liable for any loss or damage that occurs during your
              clean. We strongly recommend securing your valuables regardless.
            </p>

            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Even with insurance, all claims are subject to verification and may take up to 7 working days to process.
            </p>

            {/* Read more toggle */}
            <button
              type="button"
              onClick={() => setShowInsuranceDetails((v) => !v)}
              className="text-xs font-medium mb-3 flex items-center gap-1 transition-colors"
              style={{ color: "var(--klova-accent)" }}
            >
              {showInsuranceDetails ? "Hide details ↑" : "What does insurance cover? ↓"}
            </button>

            {showInsuranceDetails && (
              <div
                className="rounded-xl p-4 mb-4 text-xs"
                style={{ background: "var(--surface-section)", color: "var(--text-body)" }}
              >
                <p className="font-semibold mb-2" style={{ color: "var(--text-strong)" }}>Coverage</p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  <li>Accidental breakage of household items by your keeper</li>
                  <li>Theft by a Klova Keeper (verified via NIN + investigation)</li>
                  <li>Damage to furniture or fixtures during the clean</li>
                </ul>
                <p className="font-semibold mb-2" style={{ color: "var(--text-strong)" }}>Not covered</p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  <li>Pre-existing damage to items</li>
                  <li>Cash or negotiable instruments</li>
                  <li>Jewellery or electronics valued above ₦100,000 per item</li>
                  <li>Items not reported within 24 hours of your clean</li>
                </ul>
                <p className="font-semibold mb-1" style={{ color: "var(--text-strong)" }}>How to claim</p>
                <p>
                  Contact us on WhatsApp within 24 hours with photos and a description. Klova will respond
                  within 7 working days. Claims are subject to internal verification.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setShowOptOutModal(false)}
              >
                Keep my protection
              </Button>
              <button
                type="button"
                onClick={() => { patch({ wantsInsurance: false }); setShowOptOutModal(false); }}
                className="text-xs py-2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                I understand — continue without insurance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
