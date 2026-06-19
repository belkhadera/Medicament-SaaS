import express from 'express';
import {
  getAllMedications,
  getMedicationByBarcode,
  getMedicationFda,
  createMedication,
  createMedicationWithBatch,
  updateMedication,
  deleteMedication,
} from '../controllers/medicationController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getAllMedications);
router.get('/fda/:barcode', getMedicationFda);
router.get('/barcode/:barcode', getMedicationByBarcode);
router.post('/', createMedication);
router.post('/with-batch', createMedicationWithBatch);
router.put('/:id', updateMedication);
router.delete('/:id', deleteMedication);

export default router;
