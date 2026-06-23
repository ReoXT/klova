import { Router } from 'express';
import { postBooking, getBookingStatusHandler } from '../controllers/bookingController';

const router = Router();

router.post('/', postBooking);
router.get('/:id/status', getBookingStatusHandler);

export default router;
