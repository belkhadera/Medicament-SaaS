import { Request, Response } from 'express';
import Medication, { IMedication } from '../models/Medication';
import InventoryBatch, { IInventoryBatch } from '../models/InventoryBatch';
import StockMovement, { MovementReason, MovementType } from '../models/StockMovement';
import Storage from '../models/Storage';
import { deriveStatus } from '../lib/stockStatus';
import { totalStockByMedication, totalStockForMedication } from '../lib/medicationStock';
import { runExpirationAlerts } from '../jobs/expirationAlerts';
import { isPositivePrice } from './medicationController';

/**
 * Flatten a batch + its medication into the legacy `InventoryItem` shape the
 * client already consumes, so the catalog split is invisible to the UI. The
 * row `_id` is the batch id, so updates/stock-ops/deletes target the batch.
 *
 * `medicationTotal` (when provided) is the SUM of every batch quantity for this
 * medication — the never-stored total the catalog/dashboards show. It lets the
 * client judge low-stock against the whole medicine even on a single page.
 */
function flatten(batch: IInventoryBatch, med: IMedication, medicationTotal?: number) {
  return {
    _id: batch._id,
    name: med.name,
    category: med.category,
    barcode: med.barcode,
    batch: batch.batchNumber,
    stock: batch.quantity,
    minStock: batch.minStock,
    salePrice: med.salePrice,
    purchasePrice: batch.purchasePrice,
    supplier: batch.supplier ?? null,
    receivedDate: batch.receivedDate ?? null,
    expiry: batch.expiry,
    status: deriveStatus({ stock: batch.quantity, minStock: batch.minStock, expiry: batch.expiry }),
    location: batch.location,
    storageId: batch.storageId ?? null,
    shelf: batch.shelf ?? null,
    medicationId: med._id,
    medicationTotal: medicationTotal ?? batch.quantity,
    storageCondition: med.storageCondition,
  };
}

/**
 * Apply a stock change to a batch and append the ledger row. Standalone MongoDB
 * has no transactions, so we persist the balance first, then the ledger entry.
 */
async function applyMovement(
  batch: IInventoryBatch & { _id: any },
  type: MovementType,
  reason: MovementReason,
  quantity: number,
  userId?: string,
  note?: string,
) {
  const delta = type === 'out' ? -quantity : quantity;
  batch.quantity = Math.max(0, batch.quantity + delta);

  if (batch.quantity === 0) {
    // Out of stock: the lot is now free of any medicine. Record the final
    // movement (so the ledger keeps the closing balance), then delete the empty
    // lot itself — this severs its link to the medication so it no longer
    // lingers attached to it. A later restock then starts a fresh lot instead of
    // reviving this ghost row. (No batch.save() needed: it is deleted right away.)
    const movement = await StockMovement.create({
      itemId: batch._id,
      type,
      reason,
      quantity,
      balanceAfter: 0,
      userId,
      note,
    });
    await batch.deleteOne();
    return movement;
  }

  batch.status = 'active';
  await batch.save();

  const movement = await StockMovement.create({
    itemId: batch._id,
    type,
    reason,
    quantity,
    balanceAfter: batch.quantity,
    userId,
    note,
  });
  return movement;
}

/** Resolve a batch from an explicit id, or the latest batch for a barcode. */
async function resolveBatch(body: { itemId?: string; barcode?: string }) {
  if (body.itemId) return InventoryBatch.findById(body.itemId);
  if (body.barcode) {
    const med = await Medication.findOne({ barcode: body.barcode });
    if (!med) return null;
    return InventoryBatch.findOne({ medicationId: med._id }).sort({ createdAt: -1 });
  }
  return null;
}

/** Find an existing catalog entry by barcode (preferred) or name+category. */
async function findMedication(body: { barcode?: string; name?: string; category?: string }) {
  if (body.barcode) {
    const byBarcode = await Medication.findOne({ barcode: body.barcode });
    if (byBarcode) return byBarcode;
  }
  if (body.name && body.category) {
    return Medication.findOne({ name: body.name, category: body.category });
  }
  return null;
}

export const getAllInventory = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query as Record<string, string>;
    const pageRaw = req.query.page as string | undefined;
    const limitRaw = req.query.limit as string | undefined;
    const paginate = pageRaw !== undefined || limitRaw !== undefined;

    // `search` matches the medication (name / barcode) or the lot number. The
    // medication fields live on a referenced doc, so resolve matching ids first.
    const batchFilter: Record<string, any> = {};
    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const medIds = (await Medication.find({ $or: [{ name: rx }, { barcode: rx }] }).select('_id')).map((m) => m._id);
      batchFilter.$or = [{ batchNumber: rx }, { medicationId: { $in: medIds } }];
    }

    const batches = await InventoryBatch.find(batchFilter)
      .sort({ createdAt: -1 })
      .populate<{ medicationId: IMedication }>('medicationId');

    // One aggregation gives every medication's total; attach it to each row so
    // the client can show/judge the whole-medicine total without a second call.
    const totals = await totalStockByMedication();

    let rows = batches
      .filter((b) => b.medicationId) // skip orphans defensively
      .map((b) =>
        flatten(
          b as unknown as IInventoryBatch,
          b.medicationId as unknown as IMedication,
          totals.get(String((b.medicationId as any)._id)),
        ),
      );

    // Status is derived (never stored), so filter it in-memory after flattening.
    if (status && status.trim()) rows = rows.filter((r) => r.status === status.trim());

    if (!paginate) return res.json(rows);

    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.max(1, Math.min(200, Number(limitRaw) || 20));
    const total = rows.length;
    const start = (page - 1) * limit;
    res.json({
      items: rows.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors du chargement de l'inventaire", error });
  }
};

export const getInventoryByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    const med = await Medication.findOne({ barcode });
    if (!med) return res.status(404).json({ message: 'Aucun médicament trouvé pour ce code-barres' });
    // Return the latest batch flattened so the scanner can autofill the static
    // fields; if the catalog entry has no stock yet, synthesize an empty row.
    const batch = await InventoryBatch.findOne({ medicationId: med._id }).sort({ createdAt: -1 });
    if (batch) return res.json(flatten(batch, med));
    res.json({
      _id: null, name: med.name, category: med.category, barcode: med.barcode,
      batch: '', stock: 0, minStock: med.defaultMinStock,
      salePrice: med.salePrice, purchasePrice: 0,
      expiry: null, status: 'out', location: '', medicationId: med._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recherche du code-barres', error });
  }
};

export const createInventory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { medicationId, storageId, shelf, name, category, barcode, batch, stock, minStock, purchasePrice, salePrice, expiry, location } = req.body ?? {};

    // The per-lot purchase price is required and must be strictly positive.
    if (!isPositivePrice(purchasePrice)) {
      return res.status(400).json({ message: "Le prix d'achat du lot doit être un nombre strictement positif." });
    }

    // 1. Resolve the catalog entry. The connected forms send an explicit
    // `medicationId` (no guessing); legacy callers still go through find-or-create.
    let med;
    if (medicationId) {
      med = await Medication.findById(medicationId);
      if (!med) return res.status(404).json({ message: 'Médicament introuvable' });
    } else {
      med = await findMedication({ barcode, name, category });
      if (!med) {
        // Creating a catalog entry on the fly requires a valid sale price.
        if (!isPositivePrice(salePrice)) {
          return res.status(400).json({ message: 'Le prix de vente doit être un nombre strictement positif.' });
        }
        med = await Medication.create({
          name, category,
          barcode: barcode || undefined,
          defaultMinStock: minStock != null ? Number(minStock) : 10,
          salePrice: Number(salePrice),
        });
      }
    }

    // 2. Resolve the physical destination. A structured unit + shelf is preferred;
    // we derive the free-text `location` from it so the rest of the app stays coherent.
    let resolvedLocation = location;
    let resolvedStorageId: any;
    let resolvedShelf: string | undefined;
    if (storageId) {
      const storage = await Storage.findById(storageId);
      if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });
      const shelfName = shelf != null ? String(shelf) : '';
      if (shelfName && storage.shelves.length && !storage.shelves.includes(shelfName)) {
        return res.status(400).json({ message: `L'étagère « ${shelfName} » n'existe pas dans cette unité` });
      }
      resolvedStorageId = storage._id;
      resolvedShelf = shelfName || undefined;
      resolvedLocation = shelfName ? `${storage.name} / ${shelfName}` : storage.name;
    }
    if (!resolvedLocation) return res.status(400).json({ message: "Un emplacement de stockage est requis" });

    // 3. Create the physical batch.
    const qty = Number(stock) || 0;
    const newBatch = await InventoryBatch.create({
      medicationId: med._id,
      batchNumber: batch,
      expiry,
      quantity: qty,
      minStock: minStock != null ? Number(minStock) : med.defaultMinStock,
      location: resolvedLocation,
      storageId: resolvedStorageId,
      shelf: resolvedShelf,
      purchasePrice: Number(purchasePrice),
      status: qty === 0 ? 'depleted' : 'active',
    });

    // Keep the catalog reference buy price in sync with the latest received cost,
    // so the "Commander" pop-up can pre-fill it even after this lot is consumed.
    if (med.purchasePrice !== Number(purchasePrice)) {
      med.purchasePrice = Number(purchasePrice);
      await med.save();
    }

    // 3. Opening ledger entry.
    if (qty > 0) {
      await StockMovement.create({
        itemId: newBatch._id, type: 'in', reason: 'scan_in',
        quantity: qty, balanceAfter: qty, userId, note: 'Initial stock',
      });
    }
    res.status(201).json(flatten(newBatch, med));
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de la création de l'article", error });
  }
};

export const updateInventory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const batch = await InventoryBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Inventaire introuvable' });
    const med = await Medication.findById(batch.medicationId);
    if (!med) return res.status(404).json({ message: 'Médicament introuvable' });

    const b = req.body ?? {};
    // Catalog-level edits.
    if (b.name !== undefined) med.name = b.name;
    if (b.category !== undefined) med.category = b.category;
    if (b.barcode !== undefined) med.barcode = b.barcode || undefined;
    if (b.salePrice !== undefined) {
      if (!isPositivePrice(b.salePrice)) {
        return res.status(400).json({ message: 'Le prix de vente doit être un nombre strictement positif.' });
      }
      med.salePrice = Number(b.salePrice);
    }
    await med.save();

    const prevStorageId = batch.storageId ? String(batch.storageId) : '';
    const prevShelf = batch.shelf ?? '';

    // Batch-level edits (everything except quantity, handled via the ledger).
    if (b.batch !== undefined) batch.batchNumber = b.batch;
    if (b.purchasePrice !== undefined) {
      if (!isPositivePrice(b.purchasePrice)) {
        return res.status(400).json({ message: "Le prix d'achat du lot doit être un nombre strictement positif." });
      }
      batch.purchasePrice = Number(b.purchasePrice);
    }
    if (b.minStock !== undefined) batch.minStock = Number(b.minStock);
    if (b.expiry !== undefined) batch.expiry = b.expiry;
    if (b.location !== undefined) batch.location = b.location;

    // Structured storage assignment. When a unit + shelf is given, file the batch
    // there and keep the free-text `location` coherent ("<unit> / <shelf>") so the
    // rest of the app (inventory table, scanner) shows a sensible place.
    if (b.storageId !== undefined) {
      if (b.storageId) {
        const storage = await Storage.findById(b.storageId);
        if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });
        const shelf = b.shelf !== undefined ? String(b.shelf) : (batch.shelf ?? '');
        if (shelf && storage.shelves.length && !storage.shelves.includes(shelf)) {
          return res.status(400).json({ message: `L'étagère « ${shelf} » n'existe pas dans cette unité` });
        }
        batch.storageId = storage._id as any;
        batch.shelf = shelf || undefined;
        batch.location = shelf ? `${storage.name} / ${shelf}` : storage.name;
      } else {
        // Unassign from any structured storage.
        batch.storageId = undefined;
        batch.shelf = undefined;
      }
    } else if (b.shelf !== undefined) {
      batch.shelf = b.shelf || undefined;
      if (batch.storageId) {
        const storage = await Storage.findById(batch.storageId);
        if (storage) batch.location = b.shelf ? `${storage.name} / ${b.shelf}` : storage.name;
      }
    }

    const motif = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : 'Modifié depuis le stockage';
    const prevQty = batch.quantity;
    const nextQty = b.stock !== undefined ? Number(b.stock) : prevQty;
    const relocated = String(batch.storageId ?? '') !== prevStorageId || (batch.shelf ?? '') !== prevShelf;

    if (nextQty !== prevQty) {
      await applyMovement(
        batch, nextQty > prevQty ? 'in' : 'out', 'correction',
        Math.abs(nextQty - prevQty), userId, motif,
      );
    } else {
      await batch.save();
      // A relocation has no stock delta, but we still record it so the motif is
      // never lost — an `adjust` row with the running balance unchanged.
      if (relocated) {
        await StockMovement.create({
          itemId: batch._id, type: 'adjust', reason: 'correction',
          quantity: 0, balanceAfter: batch.quantity, userId, note: `Déplacé : ${motif}`,
        });
      }
    }
    res.json(flatten(batch, med));
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de la mise à jour de l'inventaire", error });
  }
};

export const deleteInventory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const batch = await InventoryBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Inventaire introuvable' });

    // Motif is supplied via the DELETE body (axios `config.data`). Record a final
    // write-off movement carrying the reason BEFORE removing the batch, and keep
    // the prior ledger so the item's history survives the hard delete.
    const { reason, note } = (req.body ?? {}) as { reason?: string; note?: string };
    const allowed: MovementReason[] = ['expired', 'damaged', 'correction'];
    if (batch.quantity > 0) {
      await StockMovement.create({
        itemId: batch._id,
        type: 'out',
        reason: allowed.includes(reason as MovementReason) ? (reason as MovementReason) : 'correction',
        quantity: batch.quantity,
        balanceAfter: 0,
        userId,
        note: note?.trim() || 'Suppression depuis le stockage',
      });
    }

    await batch.deleteOne();
    res.json({ message: 'Article supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression de l'article", error });
  }
};

// --- stock movements -------------------------------------------------------

async function respondWithBatch(res: Response, batch: IInventoryBatch, movement: any) {
  const med = await Medication.findById(batch.medicationId);
  res.status(201).json({ item: med ? flatten(batch, med) : null, movement });
}

/** Add stock to an existing batch (receive / scan-in). */
export const stockIn = async (req: Request, res: Response) => {
  try {
    const { quantity, reason, note } = req.body ?? {};
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ message: 'La quantité doit être supérieure à 0' });

    const batch = await resolveBatch(req.body);
    if (!batch) return res.status(404).json({ message: "Article d'inventaire introuvable" });

    const movement = await applyMovement(
      batch, 'in', reason === 'receipt' ? 'receipt' : 'scan_in', qty, (req as any).user?._id, note,
    );
    await respondWithBatch(res, batch, movement);
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de l'ajout de stock", error });
  }
};

/** Remove stock from a batch (dispense / write-off). This is "remove from storage". */
export const stockOut = async (req: Request, res: Response) => {
  try {
    const { quantity, reason, note } = req.body ?? {};
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ message: 'La quantité doit être supérieure à 0' });

    const batch = await resolveBatch(req.body);
    if (!batch) return res.status(404).json({ message: "Article d'inventaire introuvable" });
    if (qty > batch.quantity) {
      return res.status(400).json({ message: `Only ${batch.quantity} in stock; cannot remove ${qty}` });
    }

    const allowed: MovementReason[] = ['dispense', 'expired', 'damaged'];
    const movement = await applyMovement(
      batch, 'out', allowed.includes(reason) ? reason : 'dispense', qty, (req as any).user?._id, note,
    );
    await respondWithBatch(res, batch, movement);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors du retrait de stock', error });
  }
};

/**
 * Dispense (or write off) a quantity of a MEDICATION using FEFO — First-Expiry,
 * First-Out. Linked lots share the same `medicationId`; this consumes them in
 * ascending expiry order (earliest first, tie-broken by creation order),
 * spilling across lots until the full quantity is met. One ledger movement is
 * recorded per affected lot. Rejects when the medication's total on-hand stock
 * is insufficient.
 *
 * Body: { medicationId?, barcode?, quantity, reason?, note? }
 */
export const dispenseMedication = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { medicationId, barcode, quantity, reason, note } = req.body ?? {};
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'La quantité doit être un entier strictement positif.' });
    }

    // Resolve the medication (all linked lots share its id).
    let med = medicationId ? await Medication.findById(medicationId) : null;
    if (!med && barcode) med = await Medication.findOne({ barcode });
    if (!med) return res.status(404).json({ message: 'Médicament introuvable.' });

    // FEFO order: earliest expiry first, then oldest lot.
    const batches = await InventoryBatch.find({ medicationId: med._id, quantity: { $gt: 0 } })
      .sort({ expiry: 1, createdAt: 1 });
    const available = batches.reduce((s, b) => s + b.quantity, 0);
    if (qty > available) {
      return res.status(400).json({
        message: `Stock insuffisant : ${available} unité(s) disponible(s) pour « ${med.name} », ${qty} demandée(s).`,
      });
    }

    const allowed: MovementReason[] = ['dispense', 'expired', 'damaged'];
    const movementReason: MovementReason = allowed.includes(reason) ? reason : 'dispense';

    let remaining = qty;
    const movements: { batchId: any; batchNumber: string; expiry: Date; taken: number; balanceAfter: number }[] = [];
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.quantity);
      await applyMovement(b as any, 'out', movementReason, take, userId, note);
      movements.push({ batchId: b._id, batchNumber: b.batchNumber, expiry: b.expiry, taken: take, balanceAfter: b.quantity });
      remaining -= take;
    }

    const remainingTotal = await totalStockForMedication(med._id as any);
    res.status(201).json({
      medicationId: med._id,
      medication: med.name,
      dispensed: qty,
      reason: movementReason,
      remainingTotal,
      movements,
    });
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors du retrait de stock', error });
  }
};

/** Set a batch's stock to an absolute value (manual correction). */
export const adjustStock = async (req: Request, res: Response) => {
  try {
    const { itemId, newStock, note } = req.body ?? {};
    const target = Number(newStock);
    if (Number.isNaN(target) || target < 0) {
      return res.status(400).json({ message: 'Le nouveau stock doit être supérieur ou égal à 0' });
    }
    const batch = await InventoryBatch.findById(itemId);
    if (!batch) return res.status(404).json({ message: "Article d'inventaire introuvable" });

    const diff = target - batch.quantity;
    if (diff === 0) {
      const med = await Medication.findById(batch.medicationId);
      return res.json({ item: med ? flatten(batch, med) : null, movement: null });
    }
    const movement = await applyMovement(
      batch, diff > 0 ? 'in' : 'out', 'correction', Math.abs(diff), (req as any).user?._id, note,
    );
    await respondWithBatch(res, batch, movement);
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de l'ajustement du stock", error });
  }
};

/**
 * Manually run the expiry / low-stock alert digest now (JWT-protected). Used to
 * verify the cron pipeline without waiting for its schedule. Returns the summary
 * (counts + whether an email was sent).
 */
export const triggerExpirationAlerts = async (_req: Request, res: Response) => {
  try {
    const summary = await runExpirationAlerts();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'envoi des alertes d'inventaire", error });
  }
};

/** Ledger feed — filter by item (batch), type, reason, and date range. */
export const getMovements = async (req: Request, res: Response) => {
  try {
    const { itemId, type, reason, from, to } = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (itemId) filter.itemId = itemId;
    if (type) filter.type = type;
    if (reason) filter.reason = reason;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const movements = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('userId', 'name email')
      .populate({
        path: 'itemId',
        select: 'batchNumber location medicationId',
        populate: { path: 'medicationId', select: 'name barcode' },
      });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement des mouvements', error });
  }
};
