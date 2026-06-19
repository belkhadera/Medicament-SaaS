import express from 'express';
import { getMovementReport } from '../controllers/reportController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/movements', getMovementReport);

export default router;
