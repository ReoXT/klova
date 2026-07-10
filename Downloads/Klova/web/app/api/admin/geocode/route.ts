import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${q}, Lagos, Nigeria`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ng");
  // Bias toward Lagos
  url.searchParams.set("viewbox", "2.70,6.75,4.00,6.35");
  url.searchParams.set("bounded", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Klova-Admin/1.0 (klova-nine.vercel.app)" },
    });
    if (!res.ok) return Response.json({ results: [] });
    const data = await res.json() as Array<{ display_name: string; lat: string; lon: string }>;
    const results = data.map((r) => ({
      label: r.display_name,
      lat:   parseFloat(r.lat),
      lng:   parseFloat(r.lon),
    }));
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
