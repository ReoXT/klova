import { Router } from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey';
import {
  postTransportFare,
  postTransportInvoice,
  postResendTransportInvoice,
  postConfirmDispatch,
} from '../controllers/adminController';

const router = Router();

router.use(requireAdminKey);

router.post('/bookings/:id/transport-fare', postTransportFare);
router.post('/bookings/:id/transport-invoice', postTransportInvoice);
router.post('/bookings/:id/transport-invoice/resend', postResendTransportInvoice);
router.post('/bookings/:id/dispatch', postConfirmDispatch);

export default router;
