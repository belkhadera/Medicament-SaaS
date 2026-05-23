import express from 'express';
import healthRouter from './health';
import inventoryRouter from './inventory';
import authRouter from './auth';
import supplierRouter from './suppliers';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/inventory', inventoryRouter);
router.use('/auth', authRouter);
router.use('/suppliers', supplierRouter);

export default router;
