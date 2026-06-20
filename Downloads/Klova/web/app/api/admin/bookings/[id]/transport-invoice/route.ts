import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;

  const r = await fetch(`${API}/admin/bookings/${id}/transport-invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_API_KEY ?? ""}`,
    },
  });

  const d = await r.json().catch(() => ({}));
  return Response.json(d, { status: r.status });
}
