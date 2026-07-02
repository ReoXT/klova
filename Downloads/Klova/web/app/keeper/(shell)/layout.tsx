"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function KeeperShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/keeper/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-section)" }}>
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-subtle)", background: "var(--surface-card)" }}
      >
        <span className="wordmark text-xl" style={{ color: "var(--klova-primary)" }}>
          Klova <span className="font-normal text-base" style={{ color: "var(--text-muted)" }}>Keeper</span>
        </span>
        <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
