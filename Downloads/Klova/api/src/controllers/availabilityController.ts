import { Request, Response, NextFunction } from 'express';
import { getAlternativeDates } from '../services/availabilityService';

export async function getAlternatives(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { zone_slug, date } = req.query as Record<string, string | undefined>;

    if (!zone_slug || !date) {
      res.status(400).json({ error: { message: 'zone_slug and date are required.' } });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: { message: 'date must be in YYYY-MM-DD format.' } });
      return;
    }

    const alternative_dates = await getAlternativeDates(zone_slug, date);

    res.json({
      ok: true,
      data: { requested_date: date, alternative_dates },
    });
  } catch (err) {
    next(err);
  }
}
