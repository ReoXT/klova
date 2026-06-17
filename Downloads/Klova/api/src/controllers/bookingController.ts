import { Request, Response, NextFunction } from 'express';
import { validateBookingInput, createBooking } from '../services/bookingService';

export async function postBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = validateBookingInput(req.body as Record<string, unknown>);
    const result = await createBooking(input);
    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}
