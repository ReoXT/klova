import { Router } from 'express';
import { getAlternatives } from '../controllers/availabilityController';

const router = Router();

// GET /availability/alternatives?zone_slug=lekki-ajah&date=2026-07-01
router.get('/alternatives', getAlternatives);

export default router;
