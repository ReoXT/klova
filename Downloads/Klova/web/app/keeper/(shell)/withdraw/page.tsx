"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PinInput } from "@/components/ui/PinInput";
import { Skeleton, Spinner } from "@/components/ui/Skeleton";

type PinStatus = { is_set: boolean; locked: boolean; locked_until: string | null };
type BankAccount = { account_name: string; account_number: string; bank_name: string } | null;

function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function formatLockedUntil(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.max(1, Math.ceil(diffMs / 60000));
  return `about ${mins} minute${mins === 1 ? "" : "s"}`;
}

export default function KeeperWithdrawPage() {
  const [availableKobo, setAvailableKobo] = useState<number | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [bank, setBank] = useState<BankAccount>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<"amount" | "confirm">("amount");
  const [amountNaira, setAmountNaira] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetch("/api/keeper/wallet").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/keeper/withdrawal-pin").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/keeper/bank-account").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
    ])
      .then(([w, p, b]) => {
        if (!w.ok) throw new Error(w.d.error ?? "Failed to load wallet");
        if (!p.ok) throw new Error(p.d.error ?? "Failed to load PIN status");
        if (!b.ok) throw new Error(b.d.error ?? "Failed to load bank account");
        setAvailableKobo(w.d.available_kobo);
        setPinStatus(p.d);
        setBank(b.d.bank_account);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleContinue() {
    setAmountError(null);
    const naira = Number(amountNaira);
    if (!amountNaira || !Number.isFinite(naira) || naira <= 0) {
      setAmountError("Enter an amount");
      return;
    }
    const kobo = Math.round(naira * 100);
    if (availableKobo != null && kobo > availableKobo) {
      setAmountError(`That's more than your available balance (${ngn(availableKobo)})`);
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setPinError(null);
    setSubmitError(null);
    if (!/^\d{4}$/.test(pin)) {
      setPinError("Enter your 4-digit PIN");
      return;
    }

    setSubmitting(true);
    try {
      const amountKobo = Math.round(Number(amountNaira) * 100);
      const r = await fetch("/api/keeper/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_kobo: amountKobo, pin }),
      });
      const d = await r.json();

      if (r.status === 409 && d.pin_setup_required) {
        // Shouldn't happen (we gate before this step), but handle defensively.
        window.location.href = "/keeper/withdrawal-pin?next=/keeper/withdraw";
        return;
      }
      if (r.status === 423) {
        setLockedUntil(d.locked_until);
        setPinStatus((s) => (s ? { ...s, locked: true, locked_until: d.locked_until } : s));
        return;
      }
      if (r.status === 422 && typeof d.attempts_remaining === "number") {
        setPinError(
          d.attempts_remaining > 0
            ? `Incorrect PIN — ${d.attempts_remaining} attempt${d.attempts_remaining === 1 ? "" : "s"} left before lockout`
            : "Incorrect PIN",
        );
        setPin("");
        return;
      }
      if (r.status === 422 && d.available_kobo != null) {
        setAmountError(`That's more than your available balance (${ngn(d.available_kobo)})`);
        setStep("amount");
        return;
      }
      if (r.status === 400) {
        setSubmitError(d.error ?? "Add a payout bank account first.");
        return;
      }
      if (!r.ok) {
        setSubmitError(d.error ?? "Couldn't start the transfer. Please try again.");
        return;
      }

      setSuccessMsg(`Withdrawal of ${ngn(d.amount_kobo)} is on its way to your bank account.`);
      setAmountNaira("");
      setPin("");
      setStep("amount");
      load();
    } catch {
      setSubmitError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <Link href="/keeper/wallet" className="text-sm inline-flex items-center gap-1 mb-4" style={{ color: "var(--klova-primary)" }}>
        <BackIcon /> Wallet
      </Link>

      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>Withdraw</h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        Send your available balance to your bank account
      </p>

      {loadError ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {loadError}
        </div>
      ) : loading ? (
        <Card shadow="sm" className="p-4"><Skeleton className="h-10 w-full rounded" /></Card>
      ) : !pinStatus?.is_set ? (
        <Card shadow="sm" className="p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>Set up your withdrawal PIN</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            For security, you&apos;ll need a 4-digit PIN before you can withdraw.
          </p>
          <Link href="/keeper/withdrawal-pin?next=/keeper/withdraw">
            <Button wide className="mt-3">Set up PIN</Button>
          </Link>
        </Card>
      ) : (pinStatus.locked && pinStatus.locked_until) || lockedUntil ? (
        <Card shadow="sm" className="p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--color-error)" }}>PIN locked</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Too many incorrect attempts. Try again in {formatLockedUntil((lockedUntil ?? pinStatus.locked_until)!)}, or reset your PIN now.
          </p>
          <Link href="/keeper/withdrawal-pin?next=/keeper/withdraw">
            <Button variant="outline" wide className="mt-3">Reset PIN</Button>
          </Link>
        </Card>
      ) : (
        <>
          {successMsg && (
            <div className="rounded-2xl p-4 mb-4 text-sm" style={{ background: "oklch(0.97 0.01 145)", color: "oklch(0.4 0.1 145)" }}>
              ✓ {successMsg}
            </div>
          )}

          <Card shadow="md" className="p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Available
            </p>
            <p className="text-3xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-strong)" }}>
              {ngn(availableKobo ?? 0)}
            </p>
          </Card>

          {step === "amount" ? (
            <Card shadow="sm" className="p-4 mt-4 space-y-3">
              <FormField
                label="Amount (₦)"
                inputMode="decimal"
                value={amountNaira}
                onChange={(e) => { setAmountNaira(e.target.value.replace(/[^\d.]/g, "")); setAmountError(null); }}
                error={amountError ?? undefined}
                placeholder="500"
              />
              {!bank && (
                <p className="text-xs" style={{ color: "var(--color-error)" }}>
                  You don&apos;t have a payout account yet.{" "}
                  <Link href="/keeper/bank" className="underline">Add one</Link> before withdrawing.
                </p>
              )}
              <Button onClick={handleContinue} wide disabled={!bank}>Continue</Button>
            </Card>
          ) : (
            <Card shadow="sm" className="p-4 mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  You&apos;re withdrawing
                </p>
                <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {ngn(Math.round(Number(amountNaira) * 100))}
                </p>
                {bank && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                    to {bank.bank_name} · ****{bank.account_number.slice(-4)}
                  </p>
                )}
              </div>

              <PinInput label="Enter your PIN to confirm" value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? undefined} autoFocus />

              {submitError && <p className="text-sm text-error">{submitError}</p>}

              <div className="flex gap-2">
                <Button onClick={handleConfirm} disabled={submitting} className="flex-1">
                  {submitting ? <Spinner size="sm" /> : "Confirm withdrawal"}
                </Button>
                <button
                  onClick={() => { setStep("amount"); setPin(""); setPinError(null); setSubmitError(null); }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Back
                </button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}
