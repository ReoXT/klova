"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { BookingData, PriceBreakdown, ApiCleaner } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PHONE_RE = /^(0|\+234|234)[789]\d{9}$/;

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
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
  } else if (!PHONE_RE.test(data.phone.replace(/\s/g, ""))) {
    e.phone = "Enter a valid Nigerian phone number.";
  }
  if (!data.email.trim()) {
    e.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    e.email = "Enter a valid email address.";
  }
  return e;
}

interface LookupResult {
  returning: boolean;
  cleaners: ApiCleaner[];
}

export default function Step08Details({ data, patch, price, onNext, onBack }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);

  // Returning-customer lookup
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const phone = data.phone.replace(/\s/g, "");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Only fetch when phone is well-formed — setLookup only called in async callback
    if (!PHONE_RE.test(phone)) return;

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/customers/lookup?phone=${encodeURIComponent(phone)}`
        );
        const json = await res.json();
        if (json.ok) {
          setLookup(json.data as LookupResult);
          // Clear any stale keeper request if this phone has no previous cleaners
          if (!(json.data as LookupResult).cleaners?.length) {
            patch({ requestedCleanerId: null });
          }
        }
      } catch {
        // Silently ignore — lookup is a convenience, not blocking
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.phone]);

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

  // Only show the keeper request UI when phone is valid, returning, and has previous cleaners.
  // Derived here (not in the effect) so it disappears immediately when phone becomes invalid
  // without needing a synchronous setState inside the effect.
  const phoneValid = PHONE_RE.test(data.phone.replace(/\s/g, ""));
  const previousCleaners =
    phoneValid && lookup?.returning && lookup.cleaners.length > 0 ? lookup.cleaners : null;

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
          {...field("phone")}
        />

        <FormField
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="amara@example.com"
          {...field("email")}
        />
      </div>

      {/* ── Returning-customer keeper request (only shows for repeat customers) ── */}
      {previousCleaners && (
        <div
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: "var(--border-default)", background: "var(--surface-section)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              strokeWidth={2} style={{ color: "var(--klova-accent)" }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
              Welcome back! Request a previous keeper?
            </p>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            We&apos;ll try to assign them first. If they&apos;re unavailable, we&apos;ll find you someone equally great.
          </p>

          <div className="flex flex-col gap-2">
            {previousCleaners.map((cleaner) => {
              const selected = data.requestedCleanerId === cleaner.id;
              const initials = `${cleaner.first_name[0]}${cleaner.last_name[0]}`;
              return (
                <button
                  key={cleaner.id}
                  type="button"
                  onClick={() =>
                    patch({ requestedCleanerId: selected ? null : cleaner.id })
                  }
                  className="w-full text-left rounded-xl border-2 px-3 py-2.5 flex items-center gap-3 transition-all duration-150"
                  style={{
                    borderColor: selected ? "var(--klova-accent)" : "var(--border-default)",
                    background: selected ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  }}
                >
                  {/* Avatar */}
                  {cleaner.photo_url ? (
                    <Image
                      src={cleaner.photo_url}
                      alt={cleaner.first_name}
                      width={36}
                      height={36}
                      unoptimized
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: selected ? "var(--klova-accent)" : "var(--klova-primary-soft)",
                        color: selected ? "white" : "var(--klova-primary)",
                      }}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: selected ? "var(--klova-primary)" : "var(--text-strong)" }}>
                      {cleaner.first_name} {cleaner.last_name}
                    </p>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"
                        style={{ color: "var(--klova-accent)" }}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {Number(cleaner.rating).toFixed(1)} · {cleaner.total_jobs} jobs
                      </span>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: selected ? "var(--klova-accent)" : "var(--border-strong)",
                      background: selected ? "var(--klova-accent)" : "transparent",
                    }}
                  >
                    {selected && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                        stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {data.requestedCleanerId && (
            <button
              type="button"
              onClick={() => patch({ requestedCleanerId: null })}
              className="text-xs mt-2"
              style={{ color: "var(--text-subtle)" }}
            >
              No preference — any great keeper is fine
            </button>
          )}
        </div>
      )}

      <p className="text-xs mt-4" style={{ color: "var(--text-subtle)" }}>
        By continuing you agree to Klova&apos;s{" "}
        <a href="/terms" className="underline" target="_blank" rel="noopener">Terms</a> and{" "}
        <a href="/privacy" className="underline" target="_blank" rel="noopener">Privacy Policy</a>.
      </p>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "var(--surface-card)",
          borderTop: "1px solid var(--border-default)",
          boxShadow: "0 -4px 24px oklch(0.18 0.007 85 / 0.08)",
        }}
      >
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
          {price.base > 0 && (
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>Total amount</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {data.keeperCount === 2 ? "2 keepers" : "1 keeper"}
                  {data.bedrooms ? ` · ${data.bedrooms} bed${data.bedrooms === "1" ? "" : "s"}` : ""}
                </p>
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--klova-accent)" }}>{formatNGN(price.total)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
