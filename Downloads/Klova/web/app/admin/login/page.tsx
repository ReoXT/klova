"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push("/admin/bookings");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--surface-section)" }}
    >
      <div className="w-full max-w-sm px-4">
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="mb-7">
            <span className="wordmark text-2xl" style={{ color: "var(--klova-primary)" }}>
              Klova
            </span>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Admin · Sign in to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <FormField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <Button type="submit" loading={loading} wide className="mt-1">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
