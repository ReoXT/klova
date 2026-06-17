import { Request, Response, NextFunction } from 'express';
import { getPricingGrid } from '../services/pricingService';

export async function getPricing(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const grid = await getPricingGrid();
    res.json({ ok: true, data: grid });
  } catch (err) {
    next(err);
  }
}
