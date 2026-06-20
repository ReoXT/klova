import { Router } from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey';
import {
  postTransportFare,
  postTransportInvoice,
  postResendTransportInvoice,
  postConfirmDispatch,
  getAwaitingTransport,
  postCancelTransportOverdue,
} from '../controllers/adminController';

const router = Router();

router.use(requireAdminKey);

router.post('/bookings/:id/transport-fare', postTransportFare);
router.post('/bookings/:id/transport-invoice', postTransportInvoice);
router.post('/bookings/:id/transport-invoice/resend', postResendTransportInvoice);
router.post('/bookings/:id/dispatch', postConfirmDispatch);
router.get('/bookings/awaiting-transport', getAwaitingTransport);
router.post('/bookings/:id/cancel-transport-overdue', postCancelTransportOverdue);

export default router;
