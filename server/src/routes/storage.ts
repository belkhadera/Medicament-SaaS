import express from 'express';
import {
  getAllStorages,
  createStorage,
  updateStorage,
  deleteStorage,
} from '../controllers/storageController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllStorages);
router.post('/', createStorage);
router.put('/:id', updateStorage);
router.delete('/:id', deleteStorage);

export default router;
