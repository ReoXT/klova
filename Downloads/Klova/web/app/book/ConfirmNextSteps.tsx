import type { ReactNode } from "react";
import { Section, SoftCard } from "./confirmUI";

/**
 * The "what's next" card on the booking confirmation screen.
 *
 * Three rows (confirmed / transport / prepare) separated by whitespace, not
 * divider lines. Colour lives only in the small icon tile per row, so the card
 * stays calm and premium while each item keeps its meaning.
 */

type Tone = "confirmed" | "transport" | "prepare";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  confirmed: { bg: "oklch(0.58 0.14 155 / 0.12)", fg: "oklch(0.45 0.13 155)" },
  transport: { bg: "oklch(0.60 0.15 232 / 0.10)", fg: "oklch(0.42 0.15 232)" },
  prepare:   { bg: "oklch(0.68 0.14 67 / 0.14)",  fg: "oklch(0.50 0.12 67)" },
};

const ICON: Record<Tone, ReactNode> = {
  confirmed: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  transport: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h2m7 0H9m4 0h2m4 0V9.5a1 1 0 00-.3-.7L16 6.3a1 1 0 00-.7-.3H13m6 10h-2" />
    </svg>
  ),
  prepare: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
};

function Row({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: TONE[tone].bg, color: TONE[tone].fg }}
      >
        {ICON[tone]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-strong)" }}>{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{children}</p>
      </div>
    </div>
  );
}

export function ConfirmNextSteps({
  email,
  keeperCount = 1,
  className = "",
}: {
  email?: string;
  keeperCount?: number;
  className?: string;
}) {
  const two = keeperCount >= 2;
  return (
    <Section title="What's next" className={className}>
      <SoftCard>
        <div className="space-y-5">
          <Row tone="confirmed" title="Booking confirmed">
            Order updates and your full receipt will be sent to{" "}
            <strong style={{ color: "var(--text-body)" }}>{email || "your email"}</strong>.
            {two
              ? " Your keepers will be in touch before arrival."
              : " Your keeper will be in touch before arrival."}
          </Row>
          <Row tone="transport" title="One more thing">
            {two
              ? "Expect a Paystack payment link shortly for a combined transport fare to get your two keepers to your home. Your keepers will be dispatched once that payment is cleared."
              : "Expect a Paystack payment link shortly for a small transport fare to get your keeper to your home. Your keeper will be dispatched once that payment is cleared."}
          </Row>
          <Row tone="prepare" title={two ? "Before your keepers arrive" : "Before your keeper arrives"}>
            Please have a broom, mop, bin liners, cleaning sprays, gloves and other cleaning equipment ready at home.
            {two ? " Your keepers bring" : " Your keeper brings"} none of their own.
          </Row>
        </div>
      </SoftCard>
    </Section>
  );
}
