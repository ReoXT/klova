import { Request, Response, NextFunction } from 'express';
import { validateTransportFareInput, recordTransportFare } from '../services/transportFareService';
import { createTransportInvoice, resendTransportInvoice } from '../services/transportInvoiceService';

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

export async function postTransportInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const result = await createTransportInvoice(id);
    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function postResendTransportInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const result = await resendTransportInvoice(id);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}
