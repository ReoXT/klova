"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SelectField, FormField } from "@/components/ui/FormField";
import { Skeleton, Spinner } from "@/components/ui/Skeleton";
import { NIGERIAN_BANKS } from "@/lib/nigerianBanks";

type BankAccount = {
  id: string;
  account_name: string;
  account_number: string;
  bank_code: string;
  bank_name: string;
};

const DRAFT_KEY = "klova_keeper_bank_draft";

export default function KeeperBankPage() {
  const [current, setCurrent]   = useState<BankAccount | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing]   = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName]   = useState<string | null>(null);
  const [resolving, setResolving]         = useState(false);
  const [resolveError, setResolveError]   = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]     = useState<Record<string, string>>({});
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [savedMsg, setSavedMsg]           = useState<string | null>(null);
  const [reauthNeeded, setReauthNeeded]   = useState(false);
  const [reauthSent, setReauthSent]       = useState(false);

  // Guards the resolve response against a stale request (number/bank changed
  // while a resolve was in flight).
  const resolveSeq = useRef(0);

  const loadCurrent = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/keeper/bank-account")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load bank account");
        setCurrent(d.bank_account);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCurrent();
    // Restore a draft left behind by a step-up sign-in round trip.
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { bank_code: string; account_number: string };
        if (draft.bank_code && draft.account_number) {
          setEditing(true);
          setBankCode(draft.bank_code);
          setAccountNumber(draft.account_number);
        }
      }
    } catch {
      /* ignore malformed draft */
    }
  }, [loadCurrent]);

  const resolve = useCallback(async (number: string, code: string) => {
    if (!/^\d{10}$/.test(number) || !code) {
      setResolvedName(null);
      return;
    }
    const seq = ++resolveSeq.current;
    setResolving(true);
    setResolveError(null);
    setResolvedName(null);
    try {
      const r = await fetch(`/api/keeper/bank/resolve?account_number=${number}&bank_code=${code}`);
      const d = await r.json();
      if (seq !== resolveSeq.current) return; // superseded
      if (!r.ok || !d.account_name) {
        setResolveError(d.error ?? "Couldn't verify that account");
      } else {
        setResolvedName(d.account_name as string);
      }
    } catch {
      if (seq === resolveSeq.current) setResolveError("Couldn't reach the bank right now. Please try again.");
    } finally {
      if (seq === resolveSeq.current) setResolving(false);
    }
  }, []);

  // Auto-resolve whenever we have a full number + a bank selected.
  useEffect(() => {
    if (editing && /^\d{10}$/.test(accountNumber) && bankCode) {
      resolve(accountNumber, bankCode);
    }
  }, [editing, accountNumber, bankCode, resolve]);

  function onNumberChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(digits);
    setResolvedName(null);
    setResolveError(null);
    setFieldErrors((e) => { const n = { ...e }; delete n.account_number; return n; });
  }

  function onBankChange(code: string) {
    setBankCode(code);
    setResolvedName(null);
    setResolveError(null);
    setFieldErrors((e) => { const n = { ...e }; delete n.bank_code; return n; });
  }

  function startEdit() {
    setEditing(true);
    setBankCode(current?.bank_code ?? "");
    setAccountNumber("");
    setResolvedName(null);
    setResolveError(null);
    setSaveError(null);
    setSavedMsg(null);
  }

  function cancelEdit() {
    setEditing(false);
    setResolvedName(null);
    setResolveError(null);
    setSaveError(null);
    setFieldErrors({});
    sessionStorage.removeItem(DRAFT_KEY);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    setFieldErrors({});
    try {
      const r = await fetch("/api/keeper/bank-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
      });
      const d = await r.json();

      if (r.status === 401 && d.reauth_required) {
        // Preserve the entered details across the sign-in round trip.
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ bank_code: bankCode, account_number: accountNumber }));
        setReauthNeeded(true);
        return;
      }
      if (r.status === 422 && d.errors) { setFieldErrors(d.errors); return; }
      if (!r.ok) { setSaveError(d.error ?? "Couldn't save. Please try again."); return; }

      setCurrent(d.bank_account);
      setEditing(false);
      setSavedMsg("Payout account saved.");
      sessionStorage.removeItem(DRAFT_KEY);
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
        emailRedirectTo: `${window.location.origin}/keeper/auth/callback?next=/keeper/bank`,
      },
    });
    setReauthSent(true);
  }

  const canSave = !!resolvedName && !resolving && /^\d{10}$/.test(accountNumber) && !!bankCode;

  return (
    <div className="px-4 pt-6 pb-4">
      <Link href="/keeper/wallet" className="text-sm inline-flex items-center gap-1 mb-4" style={{ color: "var(--klova-primary)" }}>
        <BackIcon /> Wallet
      </Link>

      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>Payout account</h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        Where your withdrawals are paid
      </p>

      {loadError ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {loadError}
        </div>
      ) : (
        <>
          {/* Current account */}
          {loading ? (
            <Card shadow="sm" className="p-4"><Skeleton className="h-5 w-40 rounded" /></Card>
          ) : current ? (
            <Card shadow="sm" className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Current account
              </p>
              <p className="text-base font-semibold mt-1.5" style={{ color: "var(--text-strong)" }}>
                {current.account_name}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {current.bank_name} · ****{current.account_number.slice(-4)}
              </p>
            </Card>
          ) : (
            <Card shadow="sm" className="p-4">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No payout account yet. Add one so you can withdraw your earnings.
              </p>
            </Card>
          )}

          {savedMsg && (
            <p className="text-sm mt-3" style={{ color: "oklch(0.45 0.12 145)" }}>✓ {savedMsg}</p>
          )}

          {!editing ? (
            <Button onClick={startEdit} wide className="mt-4">
              {current ? "Change account" : "Add account"}
            </Button>
          ) : reauthNeeded ? (
            <Card shadow="sm" className="p-4 mt-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                Confirm it&apos;s you
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Changing your payout account is sensitive, so we need to confirm your identity.
                {reauthSent
                  ? " We've emailed you a sign-in link — open it, and you'll come right back here to finish. Your details are saved."
                  : " We'll email you a sign-in link. After you open it you'll return here to finish saving."}
              </p>
              {!reauthSent ? (
                <Button onClick={sendReauthLink} wide className="mt-3">Email me a sign-in link</Button>
              ) : (
                <p className="text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
                  Didn&apos;t get it? Check spam, or{" "}
                  <button className="underline" onClick={() => { setReauthSent(false); }}>try again</button>.
                </p>
              )}
            </Card>
          ) : (
            <Card shadow="sm" className="p-4 mt-4 space-y-4">
              <SelectField
                label="Bank"
                value={bankCode}
                error={fieldErrors.bank_code}
                onChange={(e) => onBankChange(e.target.value)}
              >
                <option value="">Select bank</option>
                {NIGERIAN_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </SelectField>

              <FormField
                label="Account number"
                inputMode="numeric"
                value={accountNumber}
                error={fieldErrors.account_number}
                onChange={(e) => onNumberChange(e.target.value)}
                placeholder="0123456789"
                maxLength={10}
                className="font-mono"
              />

              {resolving && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <Spinner size="xs" /> Verifying account…
                </div>
              )}
              {!resolving && resolveError && (
                <p className="text-sm text-error">{resolveError}</p>
              )}
              {!resolving && !resolveError && resolvedName && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: "oklch(0.97 0.01 145)", border: "1px solid oklch(0.85 0.06 145)" }}>
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.4 0.1 145)" }}>✓ Account verified</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-strong)" }}>{resolvedName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Make sure this is your name before saving.
                  </p>
                </div>
              )}

              {saveError && <p className="text-sm text-error">{saveError}</p>}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!canSave || saving} className="flex-1">
                  {saving ? <Spinner size="sm" /> : "Save this account"}
                </Button>
                <button
                  onClick={cancelEdit}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
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
