"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar } from "@/components/ui/Skeleton";

type Cleaner = { id: string; first_name: string; last_name: string; status: string };

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  active:    { label: "Active",    badge: "badge-success" },
  inactive:  { label: "Inactive",  badge: "badge-neutral" },
  suspended: { label: "Suspended", badge: "badge-error" },
};

export default function KeeperProfilePage() {
  const [cleaner, setCleaner]   = useState<Cleaner | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/keeper/me")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load profile");
        setCleaner(d.cleaner);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/keeper/login");
    router.refresh();
  }

  const initials = cleaner
    ? `${cleaner.first_name[0] ?? ""}${cleaner.last_name[0] ?? ""}`.toUpperCase()
    : "";
  const statusMeta = cleaner ? STATUS_LABEL[cleaner.status] : undefined;

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl mb-5" style={{ color: "var(--text-strong)" }}>Profile</h1>

      {error ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {error}
        </div>
      ) : (
        <>
          <Card shadow="sm" className="p-5 flex items-center gap-4">
            {loading ? (
              <>
                <SkeletonAvatar size="lg" />
                <div className="flex-1"><Skeleton className="h-5 w-32 rounded" /></div>
              </>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                  style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
                >
                  {initials || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold truncate" style={{ color: "var(--text-strong)" }}>
                    {cleaner?.first_name} {cleaner?.last_name}
                  </p>
                  {statusMeta && (
                    <span className={`badge badge-sm badge-soft mt-1 ${statusMeta.badge}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>
              </>
            )}
          </Card>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full mt-5 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)", color: "var(--color-error)" }}
          >
            {signingOut ? (
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
            ) : (
              <SignOutIcon />
            )}
            Sign out
          </button>
        </>
      )}
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  );
}
