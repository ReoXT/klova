/**
 * Calm, trust-forward heads-up shown on the confirmation screen after the
 * main clean payment. Sets the expectation that a separate transport fare
 * (to get the Keeper to the customer's home) will be quoted and sent as a
 * Paystack link shortly. No amount is shown — it isn't quoted yet.
 *
 * Styled with the info palette (same tokens as Alert "info") so it reads as a
 * gentle note, not an alarming charge.
 */
export function TransportNote({ className = "" }: { className?: string }) {
  const bg = "oklch(0.60 0.15 232 / 0.08)";
  const border = "oklch(0.60 0.15 232 / 0.22)";
  const color = "oklch(0.35 0.13 232)";

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${className}`}
      style={{ background: bg, borderColor: border, color }}
    >
      <span className="mt-0.5 shrink-0">
        {/* Transport / van icon — recognisably about getting there, not money */}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h2m7 0H9m4 0h2m4 0V9.5a1 1 0 00-.3-.7L16 6.3a1 1 0 00-.7-.3H13m6 10h-2" />
        </svg>
      </span>

      <div className="flex-1 text-sm leading-relaxed">
        <p className="font-semibold mb-0.5">One more thing</p>
        <p>
          Expect a Paystack payment link shortly for a small transport fare to get your Keeper to your home.
        </p>
      </div>
    </div>
  );
}
