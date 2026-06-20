import { Router } from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey';
import {
  postTransportFare,
  postTransportInvoice,
  postResendTransportInvoice,
} from '../controllers/adminController';

const router = Router();

router.use(requireAdminKey);

router.post('/bookings/:id/transport-fare', postTransportFare);
router.post('/bookings/:id/transport-invoice', postTransportInvoice);
router.post('/bookings/:id/transport-invoice/resend', postResendTransportInvoice);

export default router;
