import express from 'express';
import healthRouter from './health';
import inventoryRouter from './inventory';
import authRouter from './auth';
import supplierRouter from './suppliers';
import dashboardRouter from './dashboard';
import activityRouter from './activity';
import usersRouter from './users';
import notificationsRouter from './notifications';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/inventory', inventoryRouter);
router.use('/auth', authRouter);
router.use('/suppliers', supplierRouter);
router.use('/dashboard', dashboardRouter);
router.use('/activity', activityRouter);
router.use('/users', usersRouter);
router.use('/notifications', notificationsRouter);

export default router;
