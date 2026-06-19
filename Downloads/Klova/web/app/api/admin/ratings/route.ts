import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();

  const [{ data: cleaners, error: cErr }, { data: allRatings, error: rErr }] = await Promise.all([
    admin
      .from("cleaners")
      .select("id, first_name, last_name, photo_url, status, rating, total_jobs, zone:zones(name)")
      .order("rating", { ascending: true, nullsFirst: false }),
    admin
      .from("ratings")
      .select("cleaner_id, score, comment, created_at, customer:customers(first_name)")
      .order("created_at", { ascending: false }),
  ]);

  if (cErr || rErr) return Response.json({ error: "Database error" }, { status: 500 });

  // Group reviews by cleaner
  const reviewMap: Record<string, { score: number; comment: string | null; created_at: string; customer_first_name: string | null }[]> = {};
  for (const r of allRatings ?? []) {
    const cid = r.cleaner_id as string;
    if (!reviewMap[cid]) reviewMap[cid] = [];
    reviewMap[cid].push({
      score: r.score as number,
      comment: r.comment as string | null,
      created_at: r.created_at as string,
      customer_first_name: (r.customer as { first_name: string } | null)?.first_name ?? null,
    });
  }

  const result = (cleaners ?? []).map((c) => {
    const reviews = reviewMap[c.id] ?? [];
    const avg = reviews.length
      ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
      : null;
    return {
      id:           c.id,
      first_name:   c.first_name,
      last_name:    c.last_name,
      photo_url:    c.photo_url,
      status:       c.status,
      stored_rating: c.rating,
      total_jobs:   c.total_jobs,
      zone:         c.zone,
      review_count: reviews.length,
      avg_score:    avg !== null ? Math.round(avg * 10) / 10 : null,
      below_threshold: avg !== null && avg < 4.0,
      recent_reviews: reviews.slice(0, 5),
    };
  });

  // Sort: flagged first, then by avg score asc (worst first), then no-score at end
  result.sort((a, b) => {
    if (a.below_threshold && !b.below_threshold) return -1;
    if (!a.below_threshold && b.below_threshold) return 1;
    if (a.avg_score === null && b.avg_score !== null) return 1;
    if (a.avg_score !== null && b.avg_score === null) return -1;
    return (a.avg_score ?? 99) - (b.avg_score ?? 99);
  });

  return Response.json({ cleaners: result });
}
