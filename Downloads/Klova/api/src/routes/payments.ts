import { Router } from 'express';
import { postInitiatePayment } from '../controllers/paymentController';

const router = Router();

router.post('/initiate', postInitiatePayment);

export default router;
