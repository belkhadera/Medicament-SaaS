import express from 'express';
import { getAllUsers, updateUser, deleteUser } from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllUsers);
router.put('/:id', admin, updateUser);
router.delete('/:id', admin, deleteUser);

export default router;
