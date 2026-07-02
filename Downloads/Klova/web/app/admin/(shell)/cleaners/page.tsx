"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

/* ── Types ───────────────────────────────────────────────────── */

type Zone = { id: string; name: string; slug: string };

type Cleaner = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url: string | null;
  address: string | null;
  zone_id: string;
  zone: Zone | null;
  status: "active" | "inactive" | "suspended";
  nin_verified: boolean;
  rating: string | null;
  total_jobs: number;
  created_at: string;
  email: string | null;
  auth_user_id: string | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  zone_id: string;
  address: string;
  nin_verified: boolean;
  status: "active" | "inactive" | "suspended";
};

type BankFormState = {
  account_name: string;
  account_number: string;
  bank_code: string;
  bank_name: string;
};

const BLANK_FORM: FormState = {
  first_name: "", last_name: "", phone: "",
  zone_id: "", address: "",
  nin_verified: false, status: "active",
};

const BLANK_BANK: BankFormState = {
  account_name: "", account_number: "", bank_code: "", bank_name: "",
};

const NIGERIAN_BANKS = [
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "044", name: "Access Bank" },
  { code: "050", name: "EcoBank Nigeria" },
  { code: "057", name: "Zenith Bank" },
  { code: "058", name: "Guaranty Trust Bank (GTB)" },
  { code: "070", name: "Fidelity Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "035", name: "Wema Bank" },
  { code: "50211", name: "Kuda Microfinance Bank" },
  { code: "100004", name: "Opay (OPay Digital Services)" },
  { code: "100033", name: "PalmPay" },
  { code: "50515", name: "Moniepoint Microfinance Bank" },
];

const STATUS_META: Record<string, { label: string; badge: string; note: string }> = {
  active:    { label: "Active",    badge: "badge-success", note: "Cleaner is matchable and will receive new bookings." },
  inactive:  { label: "Inactive",  badge: "badge-neutral", note: "Cleaner is excluded from all new booking matches." },
  suspended: { label: "Suspended", badge: "badge-error",   note: "Cleaner is immediately excluded from matches and flagged for review." },
};

const PHONE_RE = /^(\+?234|0)[7-9]\d{9}$/;
function validatePhone(p: string) { return PHONE_RE.test(p.replace(/\s/g, "")); }

/* ── Avatar ──────────────────────────────────────────────────── */

function Avatar({ url, name, size = 8 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = `w-${size} h-${size} rounded-full shrink-0`;
  if (url) return <img src={url} alt={name} className={`${cls} object-cover bg-base-200`} />;
  return (
    <div className={`${cls} bg-primary/10 text-primary flex items-center justify-center text-xs font-bold`}>
      {initials || "?"}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function CleanersPage() {
  const [cleaners, setCleaners]     = useState<Cleaner[]>([]);
  const [zones, setZones]           = useState<Zone[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [panel, setPanel]           = useState<"add" | "edit" | null>(null);
  const [selected, setSelected]     = useState<Cleaner | null>(null);

  const loadCleaners = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const r = await fetch("/api/admin/cleaners");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "error");
      setCleaners(d.cleaners ?? []);
    } catch {
      setFetchError("Failed to load cleaners. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCleaners();
    fetch("/api/admin/zones").then((r) => r.json()).then((d) => setZones(d.zones ?? []));
  }, [loadCleaners]);

  function openAdd()         { setSelected(null); setPanel("add"); }
  function openEdit(c: Cleaner) { setSelected(c);   setPanel("edit"); }
  function closePanel()      { setPanel(null); setSelected(null); }

  function onSaved(cleaner: Cleaner) {
    setCleaners((prev) => {
      const idx = prev.findIndex((c) => c.id === cleaner.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = cleaner; return next; }
      return [cleaner, ...prev];
    });
    closePanel();
  }

  // Patches a cleaner in the list AND the open panel's selection, without
  // closing the panel — used for in-panel actions like the keeper invite.
  function patchCleaner(id: string, patch: Partial<Cleaner>) {
    setCleaners((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Cleaners</h1>
            <p style={{ color: "var(--text-muted)" }} className="text-sm mt-0.5">
              {cleaners.length} total
            </p>
          </div>
          <Button onClick={openAdd} size="sm">+ Add cleaner</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : fetchError ? (
          <div className="rounded-2xl bg-base-100 p-10 text-center">
            <p className="text-sm text-error mb-3">{fetchError}</p>
            <button className="btn btn-sm btn-ghost" onClick={loadCleaners}>Retry</button>
          </div>
        ) : cleaners.length === 0 ? (
          <EmptyState heading="No cleaners yet" message="Add your first cleaner to start matching bookings." />
        ) : (
          <div className="rounded-2xl bg-base-100 overflow-hidden">
            <table className="table table-zebra w-full text-sm">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th>Cleaner</th>
                  <th>Phone</th>
                  <th>Zone</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Rating</th>
                  <th>Jobs</th>
                </tr>
              </thead>
              <tbody>
                {cleaners.map((c) => {
                  const meta = STATUS_META[c.status] ?? { label: c.status, badge: "badge-ghost" };
                  return (
                    <tr
                      key={c.id}
                      className={`cursor-pointer hover:bg-base-200 transition-colors${selected?.id === c.id ? " bg-base-200" : ""}`}
                      onClick={() => openEdit(c)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar url={c.photo_url} name={`${c.first_name} ${c.last_name}`} />
                          <div>
                            <p className="font-medium">{c.first_name} {c.last_name}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {c.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{c.phone}</td>
                      <td style={{ color: "var(--text-muted)" }}>{c.zone?.name ?? "—"}</td>
                      <td>
                        <span className={`badge badge-sm badge-soft ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        {c.nin_verified
                          ? <span className="badge badge-sm badge-soft badge-success">Verified</span>
                          : <span className="badge badge-sm badge-soft badge-warning">Unverified</span>}
                      </td>
                      <td>{c.rating ? Number(c.rating).toFixed(1) : "—"}</td>
                      <td>{c.total_jobs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel */}
      {panel && (
        <CleanerPanel
          mode={panel}
          cleaner={selected}
          zones={zones}
          onClose={closePanel}
          onSaved={onSaved}
          onCleanerPatched={patchCleaner}
        />
      )}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────── */

function CleanerPanel({
  mode, cleaner, zones, onClose, onSaved, onCleanerPatched,
}: {
  mode: "add" | "edit";
  cleaner: Cleaner | null;
  zones: Zone[];
  onClose: () => void;
  onSaved: (c: Cleaner) => void;
  onCleanerPatched: (id: string, patch: Partial<Cleaner>) => void;
}) {
  const [form, setForm] = useState<FormState>(
    cleaner
      ? { first_name: cleaner.first_name, last_name: cleaner.last_name,
          phone: cleaner.phone, zone_id: cleaner.zone_id,
          address: cleaner.address ?? "", nin_verified: cleaner.nin_verified,
          status: cleaner.status }
      : BLANK_FORM,
  );
  const [bankForm, setBankForm]         = useState<BankFormState>(BLANK_BANK);
  const [bankLoaded, setBankLoaded]     = useState(false);
  const [resolving, startResolve]       = useTransition();
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [bankErrors, setBankErrors]     = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing bank account when editing
  useEffect(() => {
    if (mode === "edit" && cleaner) {
      fetch(`/api/admin/cleaners/${cleaner.id}/bank-account`)
        .then((r) => r.json())
        .then((d) => {
          if (d.bank_account) {
            setBankForm({
              account_name:   d.bank_account.account_name,
              account_number: d.bank_account.account_number,
              bank_code:      d.bank_account.bank_code,
              bank_name:      d.bank_account.bank_name,
            });
          }
          setBankLoaded(true);
        })
        .catch(() => setBankLoaded(true));
    } else {
      setBankLoaded(true);
    }
  }, [mode, cleaner]);

  function setBankField<K extends keyof BankFormState>(k: K, v: BankFormState[K]) {
    setBankForm((f) => ({ ...f, [k]: v }));
    setBankErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  }

  function tryResolve(accountNumber: string, bankCode: string) {
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return;
    setResolveError(null);
    setBankForm((f) => ({ ...f, account_name: "" }));
    startResolve(async () => {
      const r = await fetch(`/api/admin/cleaners/resolve-bank?account_number=${accountNumber}&bank_code=${bankCode}`);
      const d = await r.json() as { account_name?: string; error?: string };
      if (!r.ok || !d.account_name) {
        setResolveError(d.error ?? "Could not verify account");
      } else {
        setBankForm((f) => ({ ...f, account_name: d.account_name! }));
        setResolveError(null);
      }
    });
  }

  function onAccountNumberChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setBankForm((f) => ({ ...f, account_number: digits, account_name: "" }));
    setBankErrors((e) => { const n = { ...e }; delete n.account_number; return n; });
    setResolveError(null);
    tryResolve(digits, bankForm.bank_code);
  }

  function onBankSelect(code: string) {
    const bank = NIGERIAN_BANKS.find((b) => b.code === code);
    setBankForm((f) => ({ ...f, bank_code: code, bank_name: bank?.name ?? "", account_name: "" }));
    setBankErrors((e) => { const n = { ...e }; delete n.bank_code; return n; });
    setResolveError(null);
    tryResolve(bankForm.account_number, code);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFieldErrors((e) => ({ ...e, photo: "Only JPEG, PNG or WebP allowed" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((e) => ({ ...e, photo: "Photo must be under 5 MB" }));
      return;
    }
    setFieldErrors((e) => { const n = { ...e }; delete n.photo; return n; });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clientValidate() {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = "Required";
    if (!form.last_name.trim())  errs.last_name  = "Required";
    if (!form.phone.trim() || !validatePhone(form.phone))
      errs.phone = "Enter a valid Nigerian phone number";
    if (!form.zone_id) errs.zone_id = "Select a zone";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientValidate()) return;
    setSaving(true);
    setSaveError(null);

    const fd = new FormData();
    fd.set("first_name",   form.first_name);
    fd.set("last_name",    form.last_name);
    fd.set("phone",        form.phone);
    fd.set("zone_id",      form.zone_id);
    fd.set("address",      form.address);
    fd.set("nin_verified", String(form.nin_verified));
    fd.set("status",       form.status);
    if (photoFile) fd.set("photo", photoFile);

    try {
      const url    = mode === "add" ? "/api/admin/cleaners" : `/api/admin/cleaners/${cleaner!.id}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const r = await fetch(url, { method, body: fd });
      const d = await r.json();
      if (r.status === 422 && d.errors) { setFieldErrors(d.errors); return; }
      if (!r.ok) throw new Error(d.error ?? "Unknown error");

      // Save bank account in parallel (edit mode only, if any field filled)
      if (mode === "edit" && (bankForm.account_number || bankForm.bank_code || bankForm.account_name)) {
        const hasBankErrors = !bankForm.account_name.trim() || !/^\d{10}$/.test(bankForm.account_number) || !bankForm.bank_code;
        if (!hasBankErrors) {
          await fetch(`/api/admin/cleaners/${d.cleaner.id}/bank-account`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bankForm),
          });
        }
      }

      onSaved(d.cleaner);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const currentPhoto = photoPreview ?? cleaner?.photo_url ?? null;
  const displayName  = `${form.first_name} ${form.last_name}`.trim() || "New Cleaner";

  return (
    <div
      className="w-[380px] shrink-0 border-l bg-base-100 flex flex-col h-full overflow-y-auto"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <h2 className="font-semibold text-base">
          {mode === "add" ? "Add cleaner" : "Edit cleaner"}
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle text-lg leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <div className="p-5 flex flex-col gap-4 flex-1">

          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <Avatar url={currentPhoto} name={displayName} size={20} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-xs text-primary">
              {currentPhoto ? "Change photo" : "Upload photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
            {photoFile && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{photoFile.name}</p>}
            {fieldErrors.photo && <p className="text-xs text-error">{fieldErrors.photo}</p>}
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <PanelField label="First name" error={fieldErrors.first_name}>
              <input className={`input input-bordered w-full text-sm${fieldErrors.first_name ? " input-error" : ""}`}
                value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} placeholder="Amara" />
            </PanelField>
            <PanelField label="Last name" error={fieldErrors.last_name}>
              <input className={`input input-bordered w-full text-sm${fieldErrors.last_name ? " input-error" : ""}`}
                value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} placeholder="Okonkwo" />
            </PanelField>
          </div>

          {/* Phone */}
          <PanelField label="Phone" error={fieldErrors.phone}>
            <input className={`input input-bordered w-full text-sm${fieldErrors.phone ? " input-error" : ""}`}
              value={form.phone} onChange={(e) => setField("phone", e.target.value)}
              placeholder="08031234567" type="tel" />
          </PanelField>

          {/* Zone */}
          <PanelField label="Zone" error={fieldErrors.zone_id}>
            <select className={`select select-bordered w-full text-sm${fieldErrors.zone_id ? " select-error" : ""}`}
              value={form.zone_id} onChange={(e) => setField("zone_id", e.target.value)}>
              <option value="">Select zone</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </PanelField>

          {/* Address */}
          <PanelField label="Home address (optional)">
            <input className="input input-bordered w-full text-sm"
              value={form.address} onChange={(e) => setField("address", e.target.value)}
              placeholder="14 Admiralty Way, Lekki" />
          </PanelField>

          {/* Status (edit only) */}
          {mode === "edit" && (
            <PanelField label="Status" error={fieldErrors.status}>
              <select className="select select-bordered w-full text-sm"
                value={form.status} onChange={(e) => setField("status", e.target.value as FormState["status"])}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              {form.status !== "active" && (
                <p className={`text-xs mt-1 ${form.status === "suspended" ? "text-error" : ""}`}
                   style={form.status === "inactive" ? { color: "var(--text-muted)" } : {}}>
                  ⚠ {STATUS_META[form.status]?.note}
                </p>
              )}
            </PanelField>
          )}

          {/* Verified toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Verified</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Shows the verified badge on the cleaner profile
              </p>
            </div>
            <input type="checkbox" className="toggle toggle-success toggle-sm"
              checked={form.nin_verified} onChange={(e) => setField("nin_verified", e.target.checked)} />
          </div>

          {/* Bank account — edit mode only */}
          {mode === "edit" && bankLoaded && (
            <div className="flex flex-col gap-3 pt-2 mt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Bank account (for payouts)
              </p>

              <PanelField label="Bank" error={bankErrors.bank_code}>
                <select
                  className={`select select-bordered w-full text-sm${bankErrors.bank_code ? " select-error" : ""}`}
                  value={bankForm.bank_code}
                  onChange={(e) => onBankSelect(e.target.value)}
                >
                  <option value="">Select bank</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </PanelField>

              <PanelField label="Account number (10 digits)" error={bankErrors.account_number}>
                <input
                  className={`input input-bordered w-full text-sm font-mono${bankErrors.account_number ? " input-error" : ""}`}
                  value={bankForm.account_number}
                  onChange={(e) => onAccountNumberChange(e.target.value)}
                  placeholder="0123456789"
                  maxLength={10}
                />
              </PanelField>

              {/* Account name — auto-resolved from Paystack */}
              {resolving && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="loading loading-spinner loading-xs" />
                  Verifying account…
                </div>
              )}

              {!resolving && resolveError && (
                <p className="text-xs text-error">{resolveError}</p>
              )}

              {!resolving && !resolveError && bankForm.account_name && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: "oklch(0.97 0.01 145)", border: "1px solid oklch(0.85 0.06 145)" }}>
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.4 0.1 145)" }}>
                    ✓ Account verified
                  </p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-strong)" }}>
                    {bankForm.account_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {NIGERIAN_BANKS.find((b) => b.code === bankForm.bank_code)?.name ?? bankForm.bank_code} · ****{bankForm.account_number.slice(-4)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Keeper login — edit mode only */}
          {mode === "edit" && cleaner && (
            <KeeperLoginSection
              cleaner={cleaner}
              onUpdated={(patch) => onCleanerPatched(cleaner.id, patch)}
            />
          )}

          {saveError && (
            <div className="alert alert-soft alert-error text-sm py-2">{saveError}</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          {mode === "add" && (
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Active cleaners get 90 days of availability seeded automatically — they become matchable straight away.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Spinner /> : mode === "add" ? "Add cleaner" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ── Keeper login section ────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function KeeperLoginSection({
  cleaner,
  onUpdated,
}: {
  cleaner: Cleaner;
  onUpdated: (patch: Partial<Cleaner>) => void;
}) {
  const [email, setEmail]     = useState(cleaner.email ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [msg, setMsg]         = useState<string | null>(null);

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    setSending(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/cleaners/${cleaner.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.errors?.email ?? d.error ?? "Failed to send invite");
        return;
      }
      onUpdated({ email: d.cleaner.email, auth_user_id: d.cleaner.auth_user_id });
      setMsg(
        cleaner.auth_user_id
          ? "Invite re-sent."
          : "Account provisioned. The keeper can now sign in with a magic link at /keeper/login.",
      );
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2 mt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Keeper login
        </p>
        {cleaner.auth_user_id ? (
          <span className="badge badge-sm badge-soft badge-success">Linked</span>
        ) : cleaner.email ? (
          <span className="badge badge-sm badge-soft badge-warning">Invited</span>
        ) : (
          <span className="badge badge-sm badge-soft badge-neutral">Not invited</span>
        )}
      </div>

      <PanelField label="Email" error={error ?? undefined}>
        <input
          className={`input input-bordered w-full text-sm${error ? " input-error" : ""}`}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); setMsg(null); }}
          placeholder="keeper@example.com"
        />
      </PanelField>

      {msg && <p className="text-xs" style={{ color: "oklch(0.45 0.12 145)" }}>✓ {msg}</p>}

      {cleaner.auth_user_id && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          This keeper has already signed in and is linked to this record.
        </p>
      )}

      <button
        type="button"
        className="btn btn-soft btn-sm"
        disabled={sending || !email.trim()}
        onClick={handleInvite}
      >
        {sending ? <Spinner size="sm" /> : cleaner.auth_user_id ? "Update / re-invite" : "Send keeper invite"}
      </button>
    </div>
  );
}

function PanelField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
