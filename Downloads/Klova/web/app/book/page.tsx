"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import StepPartialAvailability from "./steps/StepPartialAvailability";

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
  const [matchedCleaners, setMatchedCleaners] = useState<ApiCleaner[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverTransport, setServerTransport] = useState<number>(0);

  type SubmitStatus = "idle" | "submitting" | "paying" | "redirecting";
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // null = not in no-match mode; [] = no-match but no alternatives; [...] = alternatives ready
  const [noMatchDates, setNoMatchDates] = useState<string[] | null>(null);
  // Non-null when a 2-keeper booking found only 1 available keeper (partial availability)
  const [partialAvailData, setPartialAvailData] = useState<{
    singleKeeperTotal: number;
    alternativeDates: string[];
  } | null>(null);
  // Tracks whether we pushed an overlay history entry so the success path
  // can replaceState instead of pushState (avoids orphaned history entries).
  const noMatchActiveRef = useRef(false);

  const patch = useCallback((partial: Partial<BookingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // ─── Browser history: seed on mount + listen for back/forward ────────────
  useEffect(() => {
    // Seed the first entry so pressing back from step 1 exits /book cleanly.
    history.replaceState({ step: 1 }, "");

    function onPopState(e: PopStateEvent) {
      const state = e.state as { step?: number } | null;
      // Clear any in-flight overlay state — if we're navigating back we want
      // the target step, not the overlay.
      noMatchActiveRef.current = false;
      setNoMatchDates(null);
      setPartialAvailData(null);
      setSubmitError(null);
      setStep(state?.step ?? 1);
      setAnimKey((k) => k + 1);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []); // setters are stable — empty deps is correct

  const goNext = useCallback(() => {
    setStep((s) => {
      const n = nextStep(s, data);
      history.pushState({ step: n }, "");
      setAnimKey((k) => k + 1);
      return n;
    });
  }, [data]);

  // Delegate to the browser so the History stack and UI state stay in sync.
  const goBack = useCallback(() => {
    history.back();
  }, []);

  // ─── POST /bookings ──────────────────────────────────────────────────────
  // dateOverride: when retrying from the no-match screen, pass the new date
  // directly so we don't rely on data.bookingDate being updated yet in state.
  // keeperCountOverride: when proceeding with 1 keeper from the partial
  // availability screen, pass 1 so we don't wait for state to flush.
  const handleSubmitBooking = useCallback(async (dateOverride?: string, keeperCountOverride?: number) => {
    setSubmitStatus("submitting");
    setSubmitError(null);

    const effectiveDate = dateOverride ?? data.bookingDate;
    const payload = buildBookingPayload({
      ...data,
      ...(dateOverride        && { bookingDate: dateOverride }),
      ...(keeperCountOverride && { keeperCount: keeperCountOverride }),
    });

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
          // Persist the tried date into state so overlay screens display it
          if (dateOverride) patch({ bookingDate: dateOverride });

          if (json?.error?.outcome === "partial_availability") {
            // 2-keeper booking; only 1 keeper free on this date.
            // The API already provides alternative dates — no extra fetch needed.
            if (!noMatchActiveRef.current) {
              history.pushState({ step: 10 }, "");
              noMatchActiveRef.current = true;
            }
            setPartialAvailData({
              singleKeeperTotal: json.error.single_keeper_option.total_amount as number,
              alternativeDates: (json.error.alternative_dates ?? []) as string[],
            });
            setNoMatchDates(null);
            setAnimKey((k) => k + 1);
            setSubmitStatus("idle");
            return;
          }

          // Full no-match — fetch nearby alternatives from the availability endpoint
          try {
            const altRes = await fetch(
              `${API_URL}/availability/alternatives?zone_slug=lekki-ajah&date=${effectiveDate}`,
            );
            const altJson = await altRes.json();
            const alternatives: string[] = altJson.ok
              ? altJson.data.alternative_dates
              : [];
            // Push a history entry so the browser back button dismisses the
            // no-match screen and returns to checkout rather than leaving /book.
            if (!noMatchActiveRef.current) {
              history.pushState({ step: 10 }, "");
              noMatchActiveRef.current = true;
            }
            setPartialAvailData(null);
            setNoMatchDates(alternatives);
          } catch {
            if (!noMatchActiveRef.current) {
              history.pushState({ step: 10 }, "");
              noMatchActiveRef.current = true;
            }
            setPartialAvailData(null);
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

      // Success — exit any overlay and advance to keeper reveal
      if (dateOverride)        patch({ bookingDate: dateOverride });
      if (keeperCountOverride) patch({ keeperCount: keeperCountOverride });
      const { booking_id, total_amount, transport_estimate, cleaners } = json.data;
      setBookingId(booking_id);
      setMatchedCleaners(cleaners as ApiCleaner[]);
      setServerTotal(total_amount);
      setServerTransport((transport_estimate as number) ?? 0);
      sessionStorage.setItem("klova_booking_id", booking_id);
      setNoMatchDates(null);
      setPartialAvailData(null);
      setSubmitStatus("idle");

      setStep((s) => {
        const n = nextStep(s, data);
        // If we came through an overlay, replace its history entry so pressing
        // back from step 11 returns to checkout, not the overlay.
        if (noMatchActiveRef.current) {
          history.replaceState({ step: n }, "");
          noMatchActiveRef.current = false;
        } else {
          history.pushState({ step: n }, "");
        }
        setAnimKey((k) => k + 1);
        return n;
      });
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setSubmitStatus("idle");
    }
  }, [data, patch]);

  // Retry from an overlay screen with a specific date
  const handleRetryWithDate = useCallback(
    (date: string) => { handleSubmitBooking(date); },
    [handleSubmitBooking],
  );

  // Proceed with 1 keeper from the partial availability screen (re-submit with keeper_count=1)
  const handleProceedWith1Keeper = useCallback(
    () => { handleSubmitBooking(undefined, 1); },
    [handleSubmitBooking],
  );

  // Return the user to the date picker so they can choose manually.
  // Replace the current overlay history entry with step 4 so pressing back
  // from the date picker returns to checkout, not the overlay.
  const handleChangeDateManually = useCallback(() => {
    noMatchActiveRef.current = false;
    history.replaceState({ step: 4 }, "");
    setNoMatchDates(null);
    setPartialAvailData(null);
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
          cleaners:    matchedCleaners,
        })
      );

      setSubmitStatus("redirecting");
      window.location.href = authorization_url;
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setSubmitStatus("idle");
    }
  }, [bookingId, data, serverTotal, matchedCleaners]);

  // ─── Price (live from API when available, hardcoded fallback) ───────────
  // serverTransport is 0 before booking is created; populated after Step 11 matching.
  const price = {
    ...(livePricing ? computePriceFromLive(data, livePricing) : computePrice(data)),
    transport: serverTransport,
  };

  const steps = getSteps(data);
  const stepIndex = getStepIndex(step, data);
  const totalSteps = steps.length;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  // Scroll to top on step change so mobile users start at the top of each step
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step, noMatchDates, partialAvailData]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Booking step ${stepIndex + 1} of ${totalSteps}`}
        className="w-full h-1"
        style={{ background: "var(--border-default)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: "var(--klova-primary)" }}
        />
      </div>

      {/* Screen-reader step announcement */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {partialAvailData !== null
          ? "Only 1 keeper available. Choose to continue or pick another date"
          : noMatchDates !== null
          ? "No availability. Please choose another date"
          : `Step ${stepIndex + 1} of ${totalSteps}`}
      </div>

      {/* Step content */}
      <div key={animKey} className="fade-in flex-1 pb-40">
        {partialAvailData !== null ? (
          <StepPartialAvailability
            date={data.bookingDate}
            singleKeeperTotal={partialAvailData.singleKeeperTotal}
            alternativeDates={partialAvailData.alternativeDates}
            submitting={submitStatus === "submitting"}
            submitError={submitError}
            onProceedWith1={handleProceedWith1Keeper}
            onRetryWithDate={handleRetryWithDate}
            onChangeDateManually={handleChangeDateManually}
          />
        ) : noMatchDates !== null ? (
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
                cleaners={matchedCleaners}
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
