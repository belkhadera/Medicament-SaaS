import express from 'express';
import healthRouter from './health';
import inventoryRouter from './inventory';
import medicationRouter from './medications';
import purchaseOrderRouter from './purchaseOrders';
import { authRoutes } from '../modules/auth';
import supplierRouter from './suppliers';
import storageRouter from './storage';
import analyticsRouter from './analytics';
import reportRouter from './reports';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/inventory', inventoryRouter);
router.use('/medications', medicationRouter);
router.use('/purchase-orders', purchaseOrderRouter);
router.use('/auth', authRoutes);
router.use('/suppliers', supplierRouter);
router.use('/storages', storageRouter);
router.use('/analytics', analyticsRouter);
router.use('/reports', reportRouter);

export default router;
