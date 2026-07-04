"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PinInput } from "@/components/ui/PinInput";
import { Skeleton, Spinner } from "@/components/ui/Skeleton";

// Where to redirect after successfully setting the PIN survives the reauth
// email round trip via sessionStorage — this is a destination path, not a
// secret, unlike the bank page's draft. The PIN digits themselves are never
// persisted anywhere client-side; after a reauth redirect the keeper simply
// retypes them once more.
const NEXT_KEY = "klova_keeper_pin_next";

type PinStatus = { is_set: boolean; locked: boolean; locked_until: string | null };

export default function KeeperWithdrawalPinPage() {
  return (
    <div className="px-4 pt-6 pb-4">
      <Suspense fallback={<div className="flex justify-center py-16"><Spinner /></div>}>
        <PinSetupForm />
      </Suspense>
    </div>
  );
}

function PinSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [nextPath, setNextPath] = useState<string | null>(null);
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reauthNeeded, setReauthNeeded] = useState(false);
  const [reauthSent, setReauthSent] = useState(false);

  useEffect(() => {
    const urlNext = searchParams.get("next");
    if (urlNext && urlNext.startsWith("/keeper/") && !urlNext.startsWith("//")) {
      sessionStorage.setItem(NEXT_KEY, urlNext);
      setNextPath(urlNext);
    } else {
      const stored = sessionStorage.getItem(NEXT_KEY);
      if (stored) setNextPath(stored);
    }
  }, [searchParams]);

  const loadStatus = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/keeper/withdrawal-pin")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load PIN status");
        setStatus(d);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleSave() {
    setFieldErrors({});
    setSaveError(null);

    if (!/^\d{4}$/.test(pin)) {
      setFieldErrors({ pin: "Enter a 4-digit PIN" });
      return;
    }
    if (pin !== confirmPin) {
      setFieldErrors({ confirm_pin: "PINs don't match" });
      return;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/keeper/withdrawal-pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirm_pin: confirmPin }),
      });
      const d = await r.json();

      if (r.status === 401 && d.reauth_required) {
        setReauthNeeded(true);
        return;
      }
      if (r.status === 422 && d.errors) { setFieldErrors(d.errors); return; }
      if (!r.ok) { setSaveError(d.error ?? "Couldn't save. Please try again."); return; }

      // Success — the PIN is never kept around, and neither is the redirect hint.
      setPin("");
      setConfirmPin("");
      sessionStorage.removeItem(NEXT_KEY);
      router.push(nextPath ?? "/keeper/wallet");
    } catch {
      setSaveError("Couldn't save right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendReauthLink() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setSaveError("Couldn't start verification. Please sign out and in again."); return; }
    await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/keeper/auth/callback?next=/keeper/withdrawal-pin`,
      },
    });
    setReauthSent(true);
  }

  const isChange = !!status?.is_set;

  return (
    <>
      <Link href="/keeper/wallet" className="text-sm inline-flex items-center gap-1 mb-4" style={{ color: "var(--klova-primary)" }}>
        <BackIcon /> Wallet
      </Link>

      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>
        {loading ? "Withdrawal PIN" : isChange ? "Change your withdrawal PIN" : "Set up your withdrawal PIN"}
      </h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        {loading
          ? " "
          : isChange
            ? "This replaces your current PIN and clears any lockout."
            : "You'll enter this every time you withdraw — it stays the same across every future sign-in."}
      </p>

      {loadError ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {loadError}
        </div>
      ) : loading ? (
        <Card shadow="sm" className="p-4"><Skeleton className="h-10 w-full rounded" /></Card>
      ) : reauthNeeded ? (
        <Card shadow="sm" className="p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
            Confirm it&apos;s you
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {isChange ? "Changing" : "Setting"} your withdrawal PIN is sensitive, so we need to confirm your identity.
            {reauthSent
              ? " We've emailed you a sign-in link — open it, and you'll come right back here to finish. For security, you'll need to re-enter your PIN."
              : " We'll email you a sign-in link. After you open it you'll return here to finish."}
          </p>
          {!reauthSent ? (
            <Button onClick={sendReauthLink} wide className="mt-3">Email me a sign-in link</Button>
          ) : (
            <p className="text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
              Didn&apos;t get it? Check spam, or{" "}
              <button className="underline" onClick={() => setReauthSent(false)}>try again</button>.
            </p>
          )}
        </Card>
      ) : (
        <Card shadow="sm" className="p-4 space-y-4">
          <PinInput
            label={isChange ? "New PIN" : "Choose a 4-digit PIN"}
            value={pin}
            onChange={(v) => { setPin(v); setFieldErrors((e) => { const n = { ...e }; delete n.pin; return n; }); }}
            error={fieldErrors.pin}
            autoFocus
          />
          <PinInput
            label="Confirm PIN"
            value={confirmPin}
            onChange={(v) => { setConfirmPin(v); setFieldErrors((e) => { const n = { ...e }; delete n.confirm_pin; return n; }); }}
            error={fieldErrors.confirm_pin}
          />

          {saveError && <p className="text-sm text-error">{saveError}</p>}

          <Button onClick={handleSave} disabled={saving} wide>
            {saving ? <Spinner size="sm" /> : isChange ? "Save new PIN" : "Set PIN"}
          </Button>
        </Card>
      )}
    </>
  );
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}
