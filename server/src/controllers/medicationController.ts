import { Request, Response } from 'express';
import Medication from '../models/Medication';
import InventoryBatch from '../models/InventoryBatch';
import StockMovement from '../models/StockMovement';
import Storage from '../models/Storage';
import { totalStockForMedication, totalStockByMedication } from '../lib/medicationStock';
import { lookupByBarcode } from '../lib/openFda';
import { conditionForCategory, StorageCondition } from '../lib/medicineReference';

/** Resolve the storage condition: an explicit valid value wins, else derive it
 *  from the category. */
const resolveCondition = (explicit: any, category: string): StorageCondition =>
  explicit === 'cold' || explicit === 'ambient' || explicit === 'controlled'
    ? explicit
    : conditionForCategory(category);

export const getAllMedications = async (_req: Request, res: Response) => {
  try {
    const meds = await Medication.find({ isActive: true }).sort({ name: 1 });
    // Attach each medication's TOTAL on-hand stock (summed across its batches,
    // never stored). This is the catalog-level source of truth for out-of-stock:
    // a depleted lot is deleted, so a fully-consumed medicine has no batch rows —
    // `totalStock === 0` is how the client now detects "rupture de stock".
    const totals = await totalStockByMedication(meds.map((m) => m._id));
    const withTotals = meds.map((m) => ({
      ...m.toObject(),
      totalStock: totals.get(String(m._id)) ?? 0,
    }));
    res.json(withTotals);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement des médicaments', error });
  }
};

export const getMedicationByBarcode = async (req: Request, res: Response) => {
  try {
    const med = await Medication.findOne({ barcode: req.params.barcode, isActive: true });
    if (!med) return res.status(404).json({ message: 'Aucun médicament trouvé pour ce code-barres' });
    res.json(med);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recherche du médicament', error });
  }
};

/** A price is valid iff it is a finite, strictly positive number (business rule). */
export const isPositivePrice = (value: any): boolean => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

export const createMedication = async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    if (!isPositivePrice(b.salePrice)) {
      return res.status(400).json({ message: 'Le prix de vente doit être un nombre strictement positif.' });
    }
    const med = await Medication.create({
      ...b,
      salePrice: Number(b.salePrice),
      storageCondition: resolveCondition(b.storageCondition, b.category),
    });
    res.status(201).json(med);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la création du médicament', error });
  }
};

/**
 * Best-effort Open FDA pre-fill for the scan "add new medication" flow. Always
 * 200: returns the mapped fields when found, or `{}` when nothing maps, so the
 * client never blocks waiting on (or failing) an FDA lookup.
 */
export const getMedicationFda = async (req: Request, res: Response) => {
  try {
    const prefill = await lookupByBarcode(req.params.barcode);
    res.json(prefill ?? {});
  } catch {
    res.json({}); // never block the scan flow on an FDA failure
  }
};

const isFutureDate = (value: any): boolean => {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
};

/**
 * Create a brand-new medication together with its FIRST physical batch in one
 * JWT-protected call (the scan "unknown barcode" flow). Validates server-side
 * (mirrors the client) and writes the opening ledger entry. Never re-creates an
 * existing medication — a duplicate barcode is rejected with 409.
 */
export const createMedicationWithBatch = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const b = req.body ?? {};

    const name = String(b.name ?? '').trim();
    const category = String(b.category ?? '').trim();
    const dosageForm = String(b.dosageForm ?? '').trim();
    const strength = String(b.strength ?? '').trim();
    const manufacturer = String(b.manufacturer ?? '').trim();
    const barcode = String(b.barcode ?? '').trim();
    const lotNumber = String(b.lotNumber ?? b.batch ?? '').trim();
    const supplier = String(b.supplier ?? '').trim();
    const salePrice = Number(b.salePrice);
    const purchasePrice = Number(b.purchasePrice);
    const minStock = Number(b.minStock);
    const quantity = Number(b.quantity ?? b.stock);

    // Server-side validation — collect every problem so the client can show all.
    const errors: string[] = [];
    if (!name) errors.push('Le nom est obligatoire.');
    if (!category) errors.push('La catégorie est obligatoire.');
    if (!dosageForm) errors.push('La forme galénique est obligatoire.');
    if (!strength) errors.push('Le dosage est obligatoire.');
    if (!manufacturer) errors.push('Le fabricant est obligatoire.');
    if (!isPositivePrice(salePrice)) errors.push('Le prix de vente doit être un nombre strictement positif.');
    if (!isPositivePrice(purchasePrice)) errors.push("Le prix d'achat doit être un nombre strictement positif.");
    if (!Number.isInteger(minStock) || minStock < 0) errors.push('Le seuil de stock minimum doit être un entier positif ou nul.');
    if (!lotNumber) errors.push('Le numéro de lot est obligatoire.');
    if (!Number.isInteger(quantity) || quantity <= 0) errors.push('La quantité initiale doit être un entier strictement positif.');
    if (!isFutureDate(b.expiry)) errors.push('La date de péremption doit être une date valide dans le futur.');
    if (errors.length) return res.status(400).json({ message: 'Validation échouée', errors });

    // Never duplicate a catalog entry.
    if (barcode) {
      const existing = await Medication.findOne({ barcode });
      if (existing) {
        return res.status(409).json({
          message: 'Un médicament avec ce code-barres existe déjà.',
          medicationId: existing._id,
        });
      }
    }

    // Resolve the physical location (optional in this flow): a structured unit +
    // shelf is preferred and drives the free-text `location`; otherwise fall back
    // to any provided free text, else mark the lot unassigned.
    let location = String(b.location ?? '').trim();
    let storageId: any;
    let shelf: string | undefined;
    if (b.storageId) {
      const storage = await Storage.findById(b.storageId);
      if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });
      const shelfName = b.shelf != null ? String(b.shelf) : '';
      if (shelfName && storage.shelves.length && !storage.shelves.includes(shelfName)) {
        return res.status(400).json({ message: `L'étagère « ${shelfName} » n'existe pas dans cette unité` });
      }
      storageId = storage._id;
      shelf = shelfName || undefined;
      location = shelfName ? `${storage.name} / ${shelfName}` : storage.name;
    }
    if (!location) location = 'Non assigné';

    const med = await Medication.create({
      name,
      category,
      barcode: barcode || undefined,
      dosageForm,
      strength,
      manufacturer,
      defaultMinStock: minStock,
      salePrice,
      // Seed the catalog reference buy price from this first lot's cost so future
      // re-orders pre-fill it (the per-lot cost still lives on the batch below).
      purchasePrice,
      // Derive the required storage condition from the category.
      storageCondition: resolveCondition(b.storageCondition, category),
    });

    const batch = await InventoryBatch.create({
      medicationId: med._id,
      batchNumber: lotNumber,
      expiry: b.expiry,
      quantity,
      minStock,
      supplier: supplier || undefined,
      location,
      storageId,
      shelf,
      purchasePrice,
      status: 'active',
    });

    // Opening ledger entry, mirroring createInventory.
    await StockMovement.create({
      itemId: batch._id,
      type: 'in',
      reason: 'scan_in',
      quantity,
      balanceAfter: quantity,
      userId,
      note: 'Stock initial (nouveau médicament)',
    });

    const totalStock = await totalStockForMedication(med._id as any);
    res.status(201).json({ medication: med, batch, totalStock });
  } catch (error: any) {
    // Surface mongoose validation messages cleanly.
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation échouée', errors: Object.values(error.errors).map((e: any) => e.message) });
    }
    res.status(400).json({ message: 'Erreur lors de la création du médicament', error });
  }
};

export const updateMedication = async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    // A sale price may be omitted (other fields edited), but if present it must be valid.
    if (b.salePrice !== undefined && !isPositivePrice(b.salePrice)) {
      return res.status(400).json({ message: 'Le prix de vente doit être un nombre strictement positif.' });
    }
    const update: Record<string, any> = b.salePrice !== undefined ? { ...b, salePrice: Number(b.salePrice) } : { ...b };
    // Keep the storage condition coherent: honour an explicit value, otherwise
    // re-derive it whenever the category is (re)set.
    if (b.storageCondition !== undefined || b.category !== undefined) {
      update.storageCondition = resolveCondition(b.storageCondition, b.category);
    }
    const med = await Medication.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!med) return res.status(404).json({ message: 'Médicament introuvable' });
    res.json(med);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la mise à jour du médicament', error });
  }
};

/** Soft-delete: keep the catalog row (batches/history reference it) but hide it. */
export const deleteMedication = async (req: Request, res: Response) => {
  try {
    const med = await Medication.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!med) return res.status(404).json({ message: 'Médicament introuvable' });
    res.json({ message: 'Médicament désactivé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du médicament', error });
  }
};
