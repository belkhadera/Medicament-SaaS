import express from 'express';
import {
  getDashboardStats,
  getCategoryDistribution,
  getInventoryTrends,
  getStockStatusOverview,
} from '../controllers/dashboardController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/categories', getCategoryDistribution);
router.get('/trends', getInventoryTrends);
router.get('/stock-status', getStockStatusOverview);

export default router;
