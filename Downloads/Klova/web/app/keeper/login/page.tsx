"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

const ERROR_COPY: Record<string, string> = {
  unlinked: "That account isn't set up as a Klova Keeper yet. Ask your admin to invite you.",
  inactive: "Your Keeper account is inactive. Contact your admin.",
  invalid_link: "That sign-in link is invalid or has expired. Request a new one below.",
};

export default function KeeperLoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--surface-section)" }}
    >
      <div className="w-full max-w-sm px-4">
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="mb-7">
            <span className="wordmark text-2xl" style={{ color: "var(--klova-primary)" }}>
              Klova
            </span>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Keeper · Sign in to continue
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    // shouldCreateUser: false — no open self-signup. This only succeeds in
    // sending an email if an admin has already invited this address via the
    // cleaners panel. Whether it exists or not, we show the same neutral
    // message below to avoid leaking which emails are registered keepers.
    await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/keeper/auth/callback`,
      },
    });

    setLoading(false);
    setSent(true);
  }

  return (
    <>
      {urlError && ERROR_COPY[urlError] && (
        <div className="alert alert-soft alert-error text-sm mb-4 py-2">
          {ERROR_COPY[urlError]}
        </div>
      )}

      {sent ? (
        <div className="alert alert-soft alert-success text-sm py-3">
          If that email is registered as a Klova Keeper, a sign-in link has been sent.
          Check your inbox and click the link to continue.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Button type="submit" loading={loading} wide className="mt-1">
            Send magic link
          </Button>
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            No password needed — we&apos;ll email you a one-time sign-in link.
          </p>
        </form>
      )}
    </>
  );
}
