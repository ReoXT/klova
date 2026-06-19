"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const BLANK_FORM: FormState = {
  first_name: "", last_name: "", phone: "",
  zone_id: "", address: "",
  nin_verified: false, status: "active",
};

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
        />
      )}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────── */

function CleanerPanel({
  mode, cleaner, zones, onClose, onSaved,
}: {
  mode: "add" | "edit";
  cleaner: Cleaner | null;
  zones: Zone[];
  onClose: () => void;
  onSaved: (c: Cleaner) => void;
}) {
  const [form, setForm] = useState<FormState>(
    cleaner
      ? { first_name: cleaner.first_name, last_name: cleaner.last_name,
          phone: cleaner.phone, zone_id: cleaner.zone_id,
          address: cleaner.address ?? "", nin_verified: cleaner.nin_verified,
          status: cleaner.status }
      : BLANK_FORM,
  );
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

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

function PanelField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
