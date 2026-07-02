"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

type Cleaner = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

export default function KeeperDashboardPage() {
  const [cleaner, setCleaner] = useState<Cleaner | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (error) {
    return (
      <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)" }}>
        <p className="text-sm" style={{ color: "var(--color-error)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
        Welcome, {cleaner?.first_name}
      </h1>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
        Keeper ID: {cleaner?.id}
      </p>
    </div>
  );
}
