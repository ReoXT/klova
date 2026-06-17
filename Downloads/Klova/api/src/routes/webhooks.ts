import { Router } from 'express';
import { postPaystackWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/paystack', postPaystackWebhook);

export default router;
