import { Request, Response, NextFunction } from 'express';
import { validateTransportFareInput, recordTransportFare } from '../services/transportFareService';
import {
  createTransportInvoice,
  resendTransportInvoice,
  resetTransportFare,
} from '../services/transportInvoiceService';
import { confirmDispatch } from '../services/dispatchService';
import {
  getAwaitingTransportBookings,
  cancelTransportOverdue,
  cancelConfirmedBooking,
} from '../services/transportCancellationService';
import { reassignKeeper, ReassignError } from '../services/reassignService';

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

export async function postResetTransportFare(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const result = await resetTransportFare(id);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function postCancelConfirmedBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const result = await cancelConfirmedBooking(id);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function postReassignKeeper(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const body = req.body as Record<string, unknown>;
    const role = (body.role as string | undefined) ?? 'lead';
    const newCleanerId = body.new_cleaner_id as string | undefined;

    if (!newCleanerId) {
      res.status(400).json({ ok: false, error: 'new_cleaner_id is required.' });
      return;
    }
    if (role !== 'lead' && role !== 'second') {
      res.status(400).json({ ok: false, error: "role must be 'lead' or 'second'." });
      return;
    }

    const result = await reassignKeeper(id, role, newCleanerId);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof ReassignError) {
      res.status(err.status).json({ ok: false, error: err.message });
      return;
    }
    next(err);
  }
}
