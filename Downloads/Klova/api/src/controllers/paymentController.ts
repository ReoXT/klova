import { Request, Response, NextFunction } from 'express';
import { initializePayment } from '../services/paymentService';

export async function postInitiatePayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { booking_id } = req.body as { booking_id?: unknown };
    if (!booking_id || typeof booking_id !== 'string') {
      res.status(400).json({ error: { message: 'booking_id is required.' } });
      return;
    }
    const result = await initializePayment(booking_id);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}
