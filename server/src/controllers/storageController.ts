import { Request, Response } from 'express';
import Storage from '../models/Storage';
import InventoryBatch, { IInventoryBatch } from '../models/InventoryBatch';
import Medication, { IMedication } from '../models/Medication';
import { deriveStatus } from '../lib/stockStatus';

/**
 * Flatten a batch + its medication into the legacy `InventoryItem` shape the
 * client consumes (same contract as inventoryController.flatten).
 */
function flatten(batch: IInventoryBatch, med: IMedication) {
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
    expiry: batch.expiry,
    status: deriveStatus({ stock: batch.quantity, minStock: batch.minStock, expiry: batch.expiry }),
    location: batch.location,
    storageId: batch.storageId ?? null,
    shelf: batch.shelf ?? null,
    medicationId: med._id,
  };
}

/** Load all batches (with medication populated), flattened and skipping orphans. */
async function loadBatches(filter: Record<string, any>) {
  const batches = await InventoryBatch.find(filter)
    .sort({ createdAt: -1 })
    .populate<{ medicationId: IMedication }>('medicationId');
  return batches
    .filter((b) => b.medicationId)
    .map((b) => flatten(b as unknown as IInventoryBatch, b.medicationId as unknown as IMedication));
}

/**
 * Every storage unit with its content nested by shelf, plus an `unassigned`
 * bucket of batches not yet filed into a structured unit. This is everything the
 * Storage screen needs in one round-trip.
 */
export const getAllStorages = async (_req: Request, res: Response) => {
  try {
    const storages = await Storage.find().sort({ type: 1, name: 1 });

    const units = await Promise.all(
      storages.map(async (s) => {
        // Only in-stock lots occupy a shelf; depleted lots are freed on stock-out.
        const items = await loadBatches({ storageId: s._id, quantity: { $gt: 0 } });
        const byShelf = new Map<string, any[]>();
        // Seed declared shelves so empty ones still render.
        for (const name of s.shelves) byShelf.set(name, []);
        for (const it of items) {
          const key = (it.shelf as string) || 'Sans étagère';
          const list = byShelf.get(key) ?? [];
          list.push(it);
          byShelf.set(key, list);
        }
        return {
          _id: s._id,
          name: s.name,
          type: s.type,
          description: s.description,
          minTemp: s.minTemp,
          maxTemp: s.maxTemp,
          shelves: [...byShelf.entries()].map(([name, shelfItems]) => ({ name, items: shelfItems })),
          itemCount: items.length,
          totalUnits: items.reduce((sum, it) => sum + it.stock, 0),
        };
      }),
    );

    const unassigned = await loadBatches({ storageId: { $in: [null, undefined] }, quantity: { $gt: 0 } });
    res.json({ units, unassigned });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement des unités de stockage', error });
  }
};

export const createStorage = async (req: Request, res: Response) => {
  try {
    const { name, type, shelves, description, minTemp, maxTemp } = req.body ?? {};
    if (!name || !type) return res.status(400).json({ message: 'Le nom et le type sont obligatoires' });
    const storage = await Storage.create({
      name: String(name).trim(),
      type,
      shelves: normalizeShelves(shelves),
      description: description || undefined,
      minTemp: minTemp != null && minTemp !== '' ? Number(minTemp) : undefined,
      maxTemp: maxTemp != null && maxTemp !== '' ? Number(maxTemp) : undefined,
    });
    res.status(201).json(storage);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Une unité portant ce nom existe déjà' });
    }
    res.status(400).json({ message: "Erreur lors de la création de l'unité de stockage", error });
  }
};

export const updateStorage = async (req: Request, res: Response) => {
  try {
    const storage = await Storage.findById(req.params.id);
    if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });

    const b = req.body ?? {};
    if (b.name !== undefined) storage.name = String(b.name).trim();
    if (b.type !== undefined) storage.type = b.type;
    if (b.description !== undefined) storage.description = b.description || undefined;
    if (b.minTemp !== undefined) storage.minTemp = b.minTemp !== '' && b.minTemp != null ? Number(b.minTemp) : undefined;
    if (b.maxTemp !== undefined) storage.maxTemp = b.maxTemp !== '' && b.maxTemp != null ? Number(b.maxTemp) : undefined;

    if (b.shelves !== undefined) {
      const next = normalizeShelves(b.shelves);
      // Block removing a shelf that still holds stock.
      const removed = storage.shelves.filter((s) => !next.includes(s));
      if (removed.length) {
        const inUse = await InventoryBatch.countDocuments({ storageId: storage._id, shelf: { $in: removed } });
        if (inUse > 0) {
          return res.status(400).json({
            message: `Impossible de retirer une étagère contenant des articles (${removed.join(', ')})`,
          });
        }
      }
      storage.shelves = next;
    }

    await storage.save();
    res.json(storage);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Une unité portant ce nom existe déjà' });
    }
    res.status(400).json({ message: "Erreur lors de la mise à jour de l'unité de stockage", error });
  }
};

export const deleteStorage = async (req: Request, res: Response) => {
  try {
    const storage = await Storage.findById(req.params.id);
    if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });

    const inUse = await InventoryBatch.countDocuments({ storageId: storage._id });
    if (inUse > 0) {
      return res.status(400).json({
        message: `Cette unité contient encore ${inUse} article(s). Videz-la avant de la supprimer.`,
      });
    }

    await storage.deleteOne();
    res.json({ message: 'Unité de stockage supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression de l'unité de stockage", error });
  }
};

/** Accept shelves as an array or a newline/comma-separated string; trim + dedupe. */
function normalizeShelves(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\n,]/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const v = String(s).trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
