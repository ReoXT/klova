import { Request, Response, NextFunction } from 'express';
import { validateTransportFareInput, recordTransportFare } from '../services/transportFareService';

export async function postTransportFare(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const input = validateTransportFareInput(req.body as Record<string, unknown>);
    const booking = await recordTransportFare(id, input);
    res.status(200).json({ ok: true, data: booking });
  } catch (err) {
    next(err);
  }
}
