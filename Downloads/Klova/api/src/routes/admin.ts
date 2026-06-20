import { Router } from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey';
import { postTransportFare } from '../controllers/adminController';

const router = Router();

router.use(requireAdminKey);

router.post('/bookings/:id/transport-fare', postTransportFare);

export default router;
