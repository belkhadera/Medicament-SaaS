import express from 'express';
import {
  getAllPurchaseOrders,
  getPurchaseOrder,
  getPurchaseOrderByOrderId,
  createPurchaseOrder,
  submitPurchaseOrder,
  receivePurchaseOrder,
  deliverPurchaseOrder,
  cancelPurchaseOrder,
} from '../controllers/purchaseOrderController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllPurchaseOrders);
// Order-id (scannable) routes must precede the generic /:id route.
router.get('/by-order-id/:orderId', getPurchaseOrderByOrderId);
router.patch('/by-order-id/:orderId/deliver', deliverPurchaseOrder);
router.get('/:id', getPurchaseOrder);
router.post('/', createPurchaseOrder);
router.patch('/:id/submit', submitPurchaseOrder);
router.patch('/:id/receive', receivePurchaseOrder);
router.patch('/:id/cancel', cancelPurchaseOrder);

export default router;
