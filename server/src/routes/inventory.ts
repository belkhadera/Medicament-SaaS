import express from 'express';
import {
  getAllInventory,
  createInventory,
  updateInventory,
  deleteInventory
} from '../controllers/inventoryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllInventory);
router.post('/', createInventory);
router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

export default router;
