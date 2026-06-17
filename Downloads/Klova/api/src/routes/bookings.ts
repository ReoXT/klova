import { Router } from 'express';
import { postBooking } from '../controllers/bookingController';

const router = Router();

router.post('/', postBooking);

export default router;
