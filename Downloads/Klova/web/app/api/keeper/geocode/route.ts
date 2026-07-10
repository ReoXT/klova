import { type NextRequest } from "next/server";
import { requireKeeperAuth } from "@/app/api/keeper/_auth";

export async function GET(req: NextRequest) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Geocoding not configured" },
      { status: 503 },
    );
  }

  const url = new URL("https://api.openrouteservice.org/geocode/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", `${q} Lagos Nigeria`);
  url.searchParams.set("boundary.country", "NG");
  url.searchParams.set("size", "5");
  url.searchParams.set("focus.point.lat", "6.5244");
  url.searchParams.set("focus.point.lon", "3.3792");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return Response.json({ results: [] });
    const data = await res.json() as {
      features?: Array<{ properties: { label: string }; geometry: { coordinates: [number, number] } }>;
    };
    const results = (data.features ?? []).map((f) => ({
      label: f.properties.label,
      lat:   f.geometry.coordinates[1],
      lng:   f.geometry.coordinates[0],
    }));
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
