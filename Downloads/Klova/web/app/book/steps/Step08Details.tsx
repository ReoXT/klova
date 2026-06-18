"use client";

import { useState } from "react";
import type { BookingData } from "../types";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Errors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

function validate(data: BookingData): Errors {
  const e: Errors = {};
  if (!data.firstName.trim()) e.firstName = "First name is required.";
  if (!data.lastName.trim())  e.lastName  = "Last name is required.";
  if (!data.phone.trim()) {
    e.phone = "Phone number is required.";
  } else if (!/^(0|\+234|234)[789]\d{9}$/.test(data.phone.replace(/\s/g, ""))) {
    e.phone = "Enter a valid Nigerian phone number.";
  }
  if (!data.email.trim()) {
    e.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    e.email = "Enter a valid email address.";
  }
  return e;
}

export default function Step08Details({ data, patch, onNext, onBack }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);

  function handleNext() {
    setTouched(true);
    const errs = validate(data);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onNext();
  }

  function field(key: keyof Errors) {
    return {
      value: data[key as keyof BookingData] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        patch({ [key]: e.target.value });
        if (touched) {
          const errs = validate({ ...data, [key]: e.target.value });
          setErrors((prev) => ({ ...prev, [key]: errs[key] }));
        }
      },
      error: errors[key],
    };
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Your details
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        We&apos;ll use these to confirm your booking and keep you updated.
      </p>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First name"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder="Amara"
            {...field("firstName")}
          />
          <FormField
            label="Last name"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            placeholder="Obi"
            {...field("lastName")}
          />
        </div>

        <FormField
          label="Phone number"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="08012345678"
          hint="Nigerian number — we'll send your booking confirmation here."
          {...field("phone")}
        />

        <FormField
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="amara@example.com"
          hint="For your booking receipt and updates."
          {...field("email")}
        />
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-subtle)" }}>
        By continuing you agree to Klova&apos;s{" "}
        <a href="/terms" className="underline" target="_blank" rel="noopener">Terms</a> and{" "}
        <a href="/privacy" className="underline" target="_blank" rel="noopener">Privacy Policy</a>.
      </p>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
      </div>
    </div>
  );
}
