import express from 'express';
import { getRecentActivity, createActivity } from '../controllers/activityController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getRecentActivity);
router.post('/', createActivity);

export default router;
