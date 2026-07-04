"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/FormField";
import { Skeleton, SkeletonAvatar, Spinner } from "@/components/ui/Skeleton";

type Cleaner = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url: string | null;
  status: string;
  nin_verified: boolean;
  rating: string | null;
  total_jobs: number;
  home_area: string | null;
  zone: { name: string } | null;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  active:    { label: "Active",    badge: "badge-success" },
  inactive:  { label: "Inactive",  badge: "badge-neutral" },
  suspended: { label: "Suspended", badge: "badge-error" },
};

export default function KeeperProfilePage() {
  const [cleaner, setCleaner]           = useState<Cleaner | null>(null);
  const [areas, setAreas]               = useState<string[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [signingOut, setSigningOut]     = useState(false);

  const [homeArea, setHomeArea]         = useState("");
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState<{ text: string; isError: boolean } | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/keeper/profile")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load profile");
        setCleaner(d.cleaner);
        setAreas(d.available_areas ?? []);
        setHomeArea(d.cleaner.home_area ?? "");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/keeper/login");
    router.refresh();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFieldErrors((f) => ({ ...f, photo: "Only JPEG, PNG or WebP allowed" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((f) => ({ ...f, photo: "Photo must be under 5 MB" }));
      return;
    }
    setFieldErrors((f) => { const n = { ...f }; delete n.photo; return n; });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  const dirty = photoFile !== null || homeArea !== (cleaner?.home_area ?? "");

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    setSaveMsg(null);
    setFieldErrors({});

    const fd = new FormData();
    if (photoFile) fd.set("photo", photoFile);
    if (homeArea !== (cleaner?.home_area ?? "")) fd.set("home_area", homeArea);

    try {
      const r = await fetch("/api/keeper/profile", { method: "PATCH", body: fd });
      const d = await r.json();
      if (r.status === 422 && d.errors) { setFieldErrors(d.errors); return; }
      if (!r.ok) throw new Error(d.error ?? "Failed to save");
      setCleaner(d.cleaner);
      setHomeArea(d.cleaner.home_area ?? "");
      setPhotoFile(null);
      setPhotoPreview(null);
      setSaveMsg({ text: "Saved.", isError: false });
    } catch (err) {
      setSaveMsg({ text: err instanceof Error ? err.message : "Something went wrong", isError: true });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl mb-5" style={{ color: "var(--text-strong)" }}>Profile</h1>
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {error}
        </div>
      </div>
    );
  }

  const initials = cleaner
    ? `${cleaner.first_name[0] ?? ""}${cleaner.last_name[0] ?? ""}`.toUpperCase()
    : "";
  const statusMeta = cleaner ? STATUS_META[cleaner.status] : undefined;
  const currentPhoto = photoPreview ?? cleaner?.photo_url ?? null;
  const ratingValue = cleaner?.rating ? Number(cleaner.rating) : null;

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl mb-5" style={{ color: "var(--text-strong)" }}>Profile</h1>

      {/* Identity */}
      <Card shadow="sm" className="p-5 flex items-center gap-4">
        {loading ? (
          <>
            <SkeletonAvatar size="lg" />
            <div className="flex-1"><Skeleton className="h-5 w-32 rounded" /></div>
          </>
        ) : (
          <>
            <div className="relative shrink-0">
              {currentPhoto ? (
                <img src={currentPhoto} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
                >
                  {initials || "?"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--klova-primary)", color: "var(--text-on-primary)", boxShadow: "var(--shadow-sm)" }}
                aria-label="Change photo"
              >
                <CameraIcon />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold truncate" style={{ color: "var(--text-strong)" }}>
                {cleaner?.first_name} {cleaner?.last_name}
              </p>
              {statusMeta && (
                <span className={`badge badge-sm badge-soft mt-1 ${statusMeta.badge}`}>{statusMeta.label}</span>
              )}
            </div>
          </>
        )}
      </Card>
      {fieldErrors.photo && <p className="text-xs text-error mt-1.5 ml-1">{fieldErrors.photo}</p>}

      {/* Rating + cleans */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card shadow="sm" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Rating</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-2 rounded" />
          ) : ratingValue ? (
            <p className="text-2xl font-bold mt-1.5" style={{ color: "var(--text-strong)" }}>
              ★ {ratingValue.toFixed(1)}
            </p>
          ) : (
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>No ratings yet</p>
          )}
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {ratingValue ? "Keep up the great work" : "Your first cleans are on the way"}
          </p>
        </Card>
        <Card shadow="sm" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cleans</p>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2 rounded" />
          ) : (
            <p className="text-2xl font-bold mt-1.5 tabular-nums" style={{ color: "var(--text-strong)" }}>
              {cleaner?.total_jobs ?? 0}
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>completed</p>
        </Card>
      </div>

      {/* Read-only details */}
      <Card shadow="sm" className="p-4 mt-4 space-y-3">
        <DetailRow label="Phone" value={loading ? undefined : cleaner?.phone} />
        <DetailRow label="Zone" value={loading ? undefined : cleaner?.zone?.name ?? "-"} />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Verification</span>
          {loading ? (
            <Skeleton className="h-5 w-20 rounded" />
          ) : (
            <span className={`badge badge-sm badge-soft ${cleaner?.nin_verified ? "badge-success" : "badge-neutral"}`}>
              {cleaner?.nin_verified ? "NIN Verified" : "Pending"}
            </span>
          )}
        </div>
      </Card>

      {/* Editable: home area */}
      <Card shadow="sm" className="p-4 mt-4">
        {loading ? (
          <Skeleton className="h-10 w-full rounded" />
        ) : (
          <SelectField
            label="Home area"
            value={homeArea}
            onChange={(e) => setHomeArea(e.target.value)}
            error={fieldErrors.home_area}
            hint="Used to suggest your transport fare to a job"
          >
            <option value="">Not set</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </SelectField>
        )}
      </Card>

      {saveMsg && (
        <p className={`text-sm mt-3 ${saveMsg.isError ? "text-error" : ""}`} style={saveMsg.isError ? {} : { color: "oklch(0.45 0.12 145)" }}>
          {saveMsg.isError ? "⚠ " : "✓ "}{saveMsg.text}
        </p>
      )}

      {!loading && (
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          wide
          className="mt-4"
        >
          {saving ? <Spinner size="sm" /> : "Save changes"}
        </Button>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
        style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)", color: "var(--color-error)" }}
      >
        {signingOut ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : <SignOutIcon />}
        Sign out
      </button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      {value === undefined ? (
        <Skeleton className="h-4 w-24 rounded" />
      ) : (
        <span className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{value}</span>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.174C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  );
}
