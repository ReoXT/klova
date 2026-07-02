import { requireKeeperAuth } from "@/app/api/keeper/_auth";

// Returns the signed-in keeper's own profile. Never accepts a cleaner_id
// from the client — cleanerId is resolved entirely from the session by
// requireKeeperAuth, which is what makes cross-keeper access structurally
// impossible for this and every other /api/keeper/* route.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  return Response.json({ cleaner: auth.cleaner });
}
