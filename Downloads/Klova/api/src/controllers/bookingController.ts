import { Request, Response, NextFunction } from 'express';
import {
  validateBookingInput,
  createBooking,
  PartialAvailabilityError,
} from '../services/bookingService';

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
    if (err instanceof PartialAvailabilityError) {
      // Not an error — the customer can act on two concrete choices.
      res.status(409).json({
        ok: false,
        error: {
          outcome:                'partial_availability',
          message:                err.message,
          requested_keeper_count: 2,
          available_keeper_count: 1,
          single_keeper_option:   err.single_keeper_price,
          alternative_dates:      err.alternative_dates,
        },
      });
      return;
    }
    next(err);
  }
}
