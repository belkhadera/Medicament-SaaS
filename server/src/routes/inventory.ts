import express from 'express';
import {
  getAllInventory,
  getInventoryByBarcode,
  createInventory,
  updateInventory,
  deleteInventory,
  stockIn,
  stockOut,
  dispenseMedication,
  adjustStock,
  getMovements,
  triggerExpirationAlerts,
} from '../controllers/inventoryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllInventory);
router.get('/movements', getMovements);
router.post('/alerts/run', triggerExpirationAlerts);
router.get('/barcode/:barcode', getInventoryByBarcode);
router.post('/', createInventory);

// Stock-movement endpoints (the ledger).
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
// FEFO dispense across a medication's linked lots (earliest expiry first).
router.post('/dispense', dispenseMedication);
router.post('/adjust', adjustStock);

router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

export default router;
