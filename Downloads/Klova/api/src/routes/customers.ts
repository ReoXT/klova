import { Router } from 'express';
import { lookupCustomer } from '../controllers/customerController';

const router = Router();

router.get('/lookup', lookupCustomer);

export default router;
