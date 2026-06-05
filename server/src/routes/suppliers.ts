import express from 'express';
import { 
  getAllSuppliers, 
  createSupplier, 
  updateSupplier, 
  deleteSupplier 
} from '../controllers/supplierController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllSuppliers);
router.post('/', admin, createSupplier);
router.put('/:id', admin, updateSupplier);
router.delete('/:id', admin, deleteSupplier);

export default router;
