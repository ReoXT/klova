import { Request, Response, NextFunction } from 'express';
import {
  validateBookingInput,
  createBooking,
  PartialAvailabilityError,
  getBookingStatus,
} from '../services/bookingService';

export async function getBookingStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const result = await getBookingStatus(id);
    if (!result) {
      res.status(404).json({ ok: false, error: { message: 'Booking not found.' } });
      return;
    }
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

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
