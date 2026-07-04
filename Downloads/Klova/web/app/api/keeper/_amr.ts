// Pure, dependency-free helpers for reading the JWT `amr` (Authentication
// Methods References) claim. Kept in its own module (no Next/Supabase imports)
// so the recency logic can be unit-tested in isolation. See _reauth.ts for
// how this gates sensitive keeper actions.

interface AmrEntry {
  method: string;
  timestamp: number;
}

// Decodes a JWT payload without verifying the signature. Callers must only
// use this on tokens already validated elsewhere (getUser); it just reads a
// claim from an already-trusted token.
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Is the token's most-recent authentication within maxAgeSeconds of
// `nowSeconds`? False if amr is missing/empty. Tolerates small negative
// skew (future timestamps up to 60s) to absorb clock drift.
export function isAmrFresh(
  token: string,
  maxAgeSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const payload = decodeJwtPayload(token);
  const amr = payload?.amr as AmrEntry[] | undefined;
  if (!Array.isArray(amr) || amr.length === 0) return false;

  const timestamps = amr
    .map((a) => (typeof a?.timestamp === "number" ? a.timestamp : NaN))
    .filter((t) => !Number.isNaN(t));
  if (timestamps.length === 0) return false;

  const mostRecent = Math.max(...timestamps);
  const age = nowSeconds - mostRecent;
  return age <= maxAgeSeconds && age >= -60;
}
