"use client";

import { useState, useCallback, useEffect } from "react";
import type { BookingData, ApiCleaner, LivePricingData } from "./types";
import {
  DEFAULT_BOOKING,
  computePrice,
  computePriceFromLive,
  buildBookingPayload,
} from "./data";
import Step01Service from "./steps/Step01Service";
import Step02Size from "./steps/Step02Size";
import Step03Address from "./steps/Step03Address";
import Step04DateTime from "./steps/Step04DateTime";
import Step05Extras from "./steps/Step05Extras";
import Step06ExtrasConfig from "./steps/Step06ExtrasConfig";
import Step07Preferences from "./steps/Step07Preferences";
import Step08Details from "./steps/Step08Details";
import Step09Summary from "./steps/Step09Summary";
import Step10Checkout from "./steps/Step10Checkout";
import Step11Matching from "./steps/Step11Matching";
import Step12Confirmation from "./steps/Step12Confirmation";
import StepNoMatch from "./steps/StepNoMatch";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function hasAppliancesSelected(data: BookingData) {
  return data.extras.appliances;
}

function getSteps(data: BookingData) {
  const steps = [1, 2, 3, 4, 5];
  if (hasAppliancesSelected(data)) steps.push(6);
  steps.push(7, 8, 9, 10, 11, 12);
  return steps;
}

function getStepIndex(stepNum: number, data: BookingData) {
  return getSteps(data).indexOf(stepNum);
}

function nextStep(current: number, data: BookingData): number {
  const steps = getSteps(data);
  const idx = steps.indexOf(current);
  return steps[idx + 1] ?? current;
}

function prevStep(current: number, data: BookingData): number {
  const steps = getSteps(data);
  const idx = steps.indexOf(current);
  return steps[idx - 1] ?? current;
}

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [data, setData] = useState<BookingData>(DEFAULT_BOOKING);

  // ─── Live pricing (UX estimate — backend recomputes before any charge) ───
  const [livePricing, setLivePricing] = useState<LivePricingData | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/pricing`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setLivePricing(json.data as LivePricingData);
      })
      .catch(() => {/* silently fall back to hardcoded prices */});
  }, []);

  // ─── Booking submission state ────────────────────────────────────────────
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [matchedCleaner, setMatchedCleaner] = useState<ApiCleaner | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);

  type SubmitStatus = "idle" | "submitting" | "paying" | "redirecting";
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // null = not in no-match mode; [] = no-match but no alternatives; [...] = alternatives ready
  const [noMatchDates, setNoMatchDates] = useState<string[] | null>(null);

  const patch = useCallback((partial: Partial<BookingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => {
      const n = nextStep(s, data);
      setAnimKey((k) => k + 1);
      return n;
    });
  }, [data]);

  const goBack = useCallback(() => {
    setStep((s) => {
      const n = prevStep(s, data);
      setAnimKey((k) => k + 1);
      return n;
    });
  }, [data]);

  // ─── POST /bookings ──────────────────────────────────────────────────────
  // dateOverride: when retrying from the no-match screen, pass the new date
  // directly so we don't rely on data.bookingDate being updated yet in state.
  const handleSubmitBooking = useCallback(async (dateOverride?: string) => {
    setSubmitStatus("submitting");
    setSubmitError(null);

    const effectiveDate = dateOverride ?? data.bookingDate;
    const payload = buildBookingPayload(
      dateOverride ? { ...data, bookingDate: dateOverride } : data,
    );

    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error?.message;

        if (res.status === 409) {
          // Persist the tried date into state so the no-match screen displays it
          if (dateOverride) patch({ bookingDate: dateOverride });

          // Fetch nearby alternatives and surface them as one-tap options
          try {
            const altRes = await fetch(
              `${API_URL}/availability/alternatives?zone_slug=lekki-ajah&date=${effectiveDate}`,
            );
            const altJson = await altRes.json();
            const alternatives: string[] = altJson.ok
              ? altJson.data.alternative_dates
              : [];
            setNoMatchDates(alternatives);
          } catch {
            setNoMatchDates([]);
          }
          setAnimKey((k) => k + 1);
          setSubmitStatus("idle");
          return;
        }

        setSubmitError(
          msg ??
            (res.status === 400
              ? "Some booking details are invalid. Please review and try again."
              : "Something went wrong. Please try again in a moment."),
        );
        setSubmitStatus("idle");
        return;
      }

      // Success — exit no-match mode and advance to keeper reveal
      if (dateOverride) patch({ bookingDate: dateOverride });
      const { booking_id, total_amount, cleaner } = json.data;
      setBookingId(booking_id);
      setMatchedCleaner(cleaner);
      setServerTotal(total_amount);
      sessionStorage.setItem("klova_booking_id", booking_id);
      setNoMatchDates(null);
      setSubmitStatus("idle");

      setStep((s) => {
        const n = nextStep(s, data);
        setAnimKey((k) => k + 1);
        return n;
      });
    } catch {
      setSubmitError("Network error — please check your connection and try again.");
      setSubmitStatus("idle");
    }
  }, [data, patch]);

  // Retry from the no-match screen with a specific date
  const handleRetryWithDate = useCallback(
    (date: string) => { handleSubmitBooking(date); },
    [handleSubmitBooking],
  );

  // Return the user to the date picker so they can choose manually
  const handleChangeDateManually = useCallback(() => {
    setNoMatchDates(null);
    setSubmitError(null);
    setStep(4);
    setAnimKey((k) => k + 1);
  }, []);

  // ─── POST /payments/initiate → redirect to Paystack ─────────────────────
  const handleInitiatePayment = useCallback(async () => {
    if (!bookingId) return;
    setSubmitStatus("paying");
    setSubmitError(null);

    try {
      const res = await fetch(`${API_URL}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error?.message;
        setSubmitError(msg ?? "Failed to start payment. Please try again.");
        setSubmitStatus("idle");
        return;
      }

      const { authorization_url } = json.data;

      // Persist summary so the /book/confirm page can read it after redirect
      sessionStorage.setItem(
        "klova_booking_summary",
        JSON.stringify({
          booking_id:  bookingId,
          service:     data.service,
          bedrooms:    data.bedrooms,
          bookingDate: data.bookingDate,
          timeSlot:    data.timeSlot,
          address:     data.address,
          firstName:   data.firstName,
          phone:       data.phone,
          email:       data.email,
          serverTotal,
          cleaner:     matchedCleaner,
        })
      );

      setSubmitStatus("redirecting");
      window.location.href = authorization_url;
    } catch {
      setSubmitError("Network error — please check your connection and try again.");
      setSubmitStatus("idle");
    }
  }, [bookingId, data, serverTotal, matchedCleaner]);

  // ─── Price (live from API when available, hardcoded fallback) ───────────
  const price = livePricing
    ? computePriceFromLive(data, livePricing)
    : computePrice(data);

  const steps = getSteps(data);
  const stepIndex = getStepIndex(step, data);
  const totalSteps = steps.length;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Progress bar */}
      <div className="w-full h-1" style={{ background: "var(--border-default)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: "var(--klova-primary)" }}
        />
      </div>

      {/* Step content */}
      <div key={animKey} className="fade-up flex-1 pb-40">
        {noMatchDates !== null ? (
          <StepNoMatch
            data={data}
            alternatives={noMatchDates}
            submitting={submitStatus === "submitting"}
            submitError={submitError}
            onRetryWithDate={handleRetryWithDate}
            onChangeDateManually={handleChangeDateManually}
          />
        ) : (
          <>
            {step === 1  && <Step01Service data={data} patch={patch} price={price} onNext={goNext} />}
            {step === 2  && <Step02Size    data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 3  && <Step03Address data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 4  && <Step04DateTime data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 5  && <Step05Extras  data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 6  && <Step06ExtrasConfig data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 7  && <Step07Preferences data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 8  && <Step08Details data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
            {step === 9  && <Step09Summary data={data} price={price} onNext={goNext} onBack={goBack} />}
            {step === 10 && (
              <Step10Checkout
                data={data}
                patch={patch}
                price={price}
                onSubmit={() => handleSubmitBooking()}
                submitStatus={submitStatus === "submitting" ? "submitting" : "idle"}
                submitError={submitError}
                onBack={goBack}
              />
            )}
            {step === 11 && (
              <Step11Matching
                cleaner={matchedCleaner}
                serverTotal={serverTotal}
                payStatus={submitStatus === "paying" || submitStatus === "redirecting" ? submitStatus : "idle"}
                payError={submitError}
                onPay={handleInitiatePayment}
              />
            )}
            {step === 12 && <Step12Confirmation data={data} price={price} />}
          </>
        )}
      </div>
    </div>
  );
}
