import { Router } from 'express';
import { getPricing } from '../controllers/pricingController';

const router = Router();

router.get('/', getPricing);

export default router;
