import { Request, Response, NextFunction } from 'express';
import { validateTransportFareInput, recordTransportFare } from '../services/transportFareService';
import { createTransportInvoice, resendTransportInvoice } from '../services/transportInvoiceService';
import { confirmDispatch } from '../services/dispatchService';
import {
  getAwaitingTransportBookings,
  cancelTransportOverdue,
} from '../services/transportCancellationService';

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

export async function getAwaitingTransport(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookings = await getAwaitingTransportBookings();
    res.status(200).json({ ok: true, count: bookings.length, data: bookings });
  } catch (err) {
    next(err);
  }
}

export async function postCancelTransportOverdue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const booking = await cancelTransportOverdue(id);
    res.status(200).json({ ok: true, data: booking });
  } catch (err) {
    next(err);
  }
}

export async function postConfirmDispatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const booking = await confirmDispatch(id);
    res.status(200).json({ ok: true, data: booking });
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
