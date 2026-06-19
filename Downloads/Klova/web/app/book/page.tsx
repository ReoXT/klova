"use client";

import { useState, useCallback } from "react";
import type { BookingData } from "./types";
import { DEFAULT_BOOKING, computePrice } from "./data";
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

const STEP_LABELS = [
  "Service",
  "Apartment",
  "Address",
  "Date & Time",
  "Add-ons",
  "Customise",
  "Preferences",
  "Your Details",
  "Review",
  "Checkout",
  "Matching",
  "Confirmed",
];

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

  const price = computePrice(data);
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
          style={{
            width: `${progressPct}%`,
            background: "var(--klova-primary)",
          }}
        />
      </div>

      {/* Step content */}
      <div key={animKey} className="fade-up flex-1 pb-40">
        {step === 1  && <Step01Service data={data} patch={patch} price={price} onNext={goNext} />}
        {step === 2  && <Step02Size    data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 3  && <Step03Address data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 4  && <Step04DateTime data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 5  && <Step05Extras  data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 6  && <Step06ExtrasConfig data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 7  && <Step07Preferences data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 8  && <Step08Details data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 9  && <Step09Summary data={data} price={price} onNext={goNext} onBack={goBack} />}
        {step === 10 && <Step10Checkout data={data} patch={patch} price={price} onNext={goNext} onBack={goBack} />}
        {step === 11 && <Step11Matching data={data} onNext={goNext} />}
        {step === 12 && <Step12Confirmation data={data} price={price} />}
      </div>
    </div>
  );
}
