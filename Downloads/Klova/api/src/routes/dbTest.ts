import { Router } from 'express';
import { getDbTest } from '../controllers/dbTestController';

const router = Router();
router.get('/', getDbTest);

export default router;
