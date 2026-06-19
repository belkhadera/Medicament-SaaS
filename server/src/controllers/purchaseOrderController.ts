import { Request, Response } from 'express';
import crypto from 'crypto';
import PurchaseOrder from '../models/PurchaseOrder';
import Supplier from '../models/Supplier';
import Medication from '../models/Medication';
import InventoryBatch from '../models/InventoryBatch';
import StockMovement from '../models/StockMovement';
import Storage from '../models/Storage';
import { isPositivePrice } from './medicationController';

/**
 * Last known purchase price for a medication = the purchasePrice of its most
 * recently created batch. Used to pre-fill the delivery-confirmation form so the
 * user adjusts from the last cost rather than re-typing it. Falls back to a
 * provided default (the order line's negotiated unit price) when no lot exists.
 */
async function lastPurchasePrice(medicationId: any, fallback: number): Promise<number> {
  const latest = await InventoryBatch.findOne({ medicationId })
    .sort({ createdAt: -1 })
    .select('purchasePrice');
  return latest && isPositivePrice(latest.purchasePrice) ? latest.purchasePrice : fallback;
}

const populatePO = (q: any) =>
  q.populate('supplierId', 'name contact phone status')
   .populate('lines.medicationId', 'name category barcode defaultMinStock salePrice');

/** Generate the next human-readable reference, e.g. PO-2026-0007. */
async function nextReference() {
  const year = new Date().getFullYear();
  const seq = (await PurchaseOrder.countDocuments()) + 1;
  return `PO-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate a unique, scannable order id, e.g. "ORD-LXK2P9-7F3A". Alphanumeric so
 * it encodes cleanly as a QR code; the ORD- prefix lets the scanner route it to
 * the delivery flow. Retries on the (very unlikely) unique-index collision.
 */
async function genOrderId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
    const candidate = `ORD-${ts}-${rand}`;
    if (!(await PurchaseOrder.exists({ orderId: candidate }))) return candidate;
  }
  // Fallback: a full UUID is effectively collision-proof.
  return `ORD-${crypto.randomUUID().toUpperCase()}`;
}

/** Map the internal status to the task's pending/delivered/cancelled view. */
const DELIVERABLE = ['draft', 'ordered', 'partial'];

const isFutureDate = (value: any): boolean => {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
};

export const getAllPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { status, supplierId } = req.query as Record<string, string>;
    const pageRaw = req.query.page as string | undefined;
    const limitRaw = req.query.limit as string | undefined;
    const paginate = pageRaw !== undefined || limitRaw !== undefined;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;

    if (!paginate) {
      const orders = await populatePO(PurchaseOrder.find(filter).sort({ createdAt: -1 }));
      return res.json(orders);
    }

    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.max(1, Math.min(200, Number(limitRaw) || 20));
    const total = await PurchaseOrder.countDocuments(filter);
    const items = await populatePO(
      PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    );
    res.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement des commandes', error });
  }
};

/** Lookup an order by its scannable orderId (used by the delivery scanner). */
export const getPurchaseOrderByOrderId = async (req: Request, res: Response) => {
  try {
    const order = await populatePO(PurchaseOrder.findOne({ orderId: req.params.orderId }));
    if (!order) return res.status(404).json({ message: 'Commande introuvable pour ce code' });
    // Augment each line with the last known purchase price so the delivery form
    // pre-fills the per-batch cost (editable). Falls back to the ordered price.
    const obj = order.toObject();
    obj.lines = await Promise.all(
      obj.lines.map(async (l: any) => ({
        ...l,
        lastPurchasePrice: await lastPurchasePrice(
          (l.medicationId && l.medicationId._id) || l.medicationId,
          l.unitPrice,
        ),
      })),
    );
    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement de la commande', error });
  }
};

export const getPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const order = await populatePO(PurchaseOrder.findById(req.params.id));
    if (!order) return res.status(404).json({ message: "Commande d'achat introuvable" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement de la commande', error });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { supplierId, lines } = req.body ?? {};
    if (!supplierId) return res.status(400).json({ message: 'Le fournisseur est obligatoire' });
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: 'Au moins une ligne est requise' });
    }

    const cleanLines = lines.map((l: any) => ({
      medicationId: l.medicationId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice) || 0,
      receivedQuantity: 0,
    }));
    const totalCost = cleanLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    const order = await PurchaseOrder.create({
      reference: await nextReference(),
      orderId: await genOrderId(),
      supplierId,
      lines: cleanLines,
      totalCost,
      status: 'draft',
      createdBy: (req as any).user?._id,
    });
    res.status(201).json(await populatePO(PurchaseOrder.findById(order._id)));
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la création de la commande', error });
  }
};

/** draft -> ordered: lock it in and bump the supplier's order count. */
export const submitPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Commande d'achat introuvable" });
    if (order.status !== 'draft') {
      return res.status(400).json({ message: `Seules les commandes en brouillon peuvent être soumises (actuel : ${order.status})` });
    }
    order.status = 'ordered';
    order.orderedAt = new Date();
    await order.save();
    await Supplier.findByIdAndUpdate(order.supplierId, { $inc: { orders: 1 } });
    res.json(await populatePO(PurchaseOrder.findById(order._id)));
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la soumission de la commande', error });
  }
};

/**
 * Receive goods against an order. For each received line we create a physical
 * InventoryBatch and an `in`/`receipt` ledger entry, then advance the order to
 * `partial` or `received`. Supports receiving in several deliveries.
 *
 * Body: { lines: [{ medicationId, batchNumber, expiry, location, receivedQuantity }] }
 */
export const receivePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Commande d'achat introuvable" });
    if (order.status === 'cancelled' || order.status === 'received') {
      return res.status(400).json({ message: `Impossible de réceptionner une commande « ${order.status} »` });
    }

    const incoming: any[] = req.body?.lines ?? [];
    for (const recv of incoming) {
      const qty = Number(recv.receivedQuantity);
      if (!qty || qty <= 0) continue;

      const line = order.lines.find((l) => String(l.medicationId) === String(recv.medicationId));
      if (!line) continue;

      const med = await Medication.findById(line.medicationId);
      if (!med) continue;

      // Per-lot purchase price: use the value entered for this delivery, else
      // fall back to the order line's negotiated unit price.
      const purchasePrice = isPositivePrice(recv.purchasePrice)
        ? Number(recv.purchasePrice)
        : line.unitPrice;

      // Resolve the storage destination (optional). A structured unit + shelf is
      // preferred and drives the free-text `location`; otherwise fall back to any
      // free text, else mark the lot unassigned. Mirrors the scan-to-deliver flow.
      let location = String(recv.location ?? '').trim();
      let storageId: any;
      let shelf: string | undefined;
      if (recv.storageId) {
        const storage = await Storage.findById(recv.storageId);
        if (!storage) return res.status(404).json({ message: 'Unité de stockage introuvable' });
        const shelfName = recv.shelf != null ? String(recv.shelf) : '';
        if (shelfName && storage.shelves.length && !storage.shelves.includes(shelfName)) {
          return res.status(400).json({ message: `L'étagère « ${shelfName} » n'existe pas dans cette unité` });
        }
        storageId = storage._id;
        shelf = shelfName || undefined;
        location = shelfName ? `${storage.name} / ${shelfName}` : storage.name;
      }
      if (!location) location = 'UNASSIGNED';

      // Create the received lot and record it in the ledger.
      const batch = await InventoryBatch.create({
        medicationId: med._id,
        batchNumber: recv.batchNumber || `${order.reference}-${med.name}`,
        expiry: recv.expiry,
        quantity: qty,
        minStock: med.defaultMinStock,
        location,
        storageId,
        shelf,
        purchasePrice,
        purchaseOrderId: order._id,
        status: 'active',
      });
      await StockMovement.create({
        itemId: batch._id, type: 'in', reason: 'receipt',
        quantity: qty, balanceAfter: qty, userId,
        note: `Received against ${order.reference}`,
      });

      // Keep the catalog reference buy price in sync with the latest received
      // cost, so re-orders pre-fill it even after this lot is consumed.
      if (med.purchasePrice !== purchasePrice) {
        med.purchasePrice = purchasePrice;
        await med.save();
      }

      line.receivedQuantity += qty;
    }

    // Advance status based on how much of the order has now arrived.
    const fullyReceived = order.lines.every((l) => l.receivedQuantity >= l.quantity);
    const anyReceived = order.lines.some((l) => l.receivedQuantity > 0);
    if (fullyReceived) {
      order.status = 'received';
      order.receivedAt = new Date();
    } else if (anyReceived) {
      order.status = 'partial';
    }
    await order.save();
    res.json(await populatePO(PurchaseOrder.findById(order._id)));
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la réception de la commande', error });
  }
};

/**
 * Confirm delivery of an order by its scannable orderId (the scan-to-deliver
 * flow). Idempotent: a delivered/cancelled order is never reprocessed. On success
 * it creates a batch per item (with received qty + lot + expiry) and an opening
 * ledger entry, then marks the order delivered — so stock, expiry alerts and the
 * analytics dashboard update automatically.
 *
 * Body: { items: [{ medicationId, receivedQuantity, lotNumber, expiry, location? }] }
 */
export const deliverPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const order = await PurchaseOrder.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: 'Commande introuvable pour ce code' });

    // Idempotency — already delivered or cancelled is a no-op (no double-stocking).
    if (order.status === 'received') {
      const populated = await populatePO(PurchaseOrder.findById(order._id));
      return res.status(409).json({ message: 'Cette commande a déjà été livrée.', order: populated, deliveredAt: order.deliveredAt });
    }
    if (order.status === 'cancelled') {
      return res.status(409).json({ message: 'Cette commande a été annulée.' });
    }
    if (!DELIVERABLE.includes(order.status)) {
      return res.status(400).json({ message: `Impossible de livrer une commande « ${order.status} ».` });
    }

    const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ message: 'Aucun article à livrer.' });

    // Validate everything BEFORE writing anything.
    const errors: string[] = [];
    const prepared: {
      line: any; med: any; qty: number; lotNumber: string; expiry: any;
      location: string; storageId?: any; shelf?: string; purchasePrice: number;
    }[] = [];
    for (const item of items) {
      const line = order.lines.find((l) => String(l.medicationId) === String(item.medicationId));
      if (!line) { errors.push(`Article inconnu dans la commande : ${item.medicationId}`); continue; }
      const med = await Medication.findById(line.medicationId);
      const label = med?.name ?? String(line.medicationId);

      const qty = Number(item.receivedQuantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        errors.push(`${label} : la quantité reçue doit être un entier strictement positif.`);
      } else if (qty > line.quantity) {
        errors.push(`${label} : la quantité reçue (${qty}) dépasse la quantité commandée (${line.quantity}).`);
      }
      const lotNumber = String(item.lotNumber ?? '').trim();
      if (!lotNumber) errors.push(`${label} : le numéro de lot est obligatoire.`);
      if (!isFutureDate(item.expiry)) errors.push(`${label} : la date de péremption doit être une date future valide.`);
      // Per-batch purchase price: required + strictly positive (the user may have
      // adjusted the pre-filled last-known cost for this delivery).
      if (!isPositivePrice(item.purchasePrice)) {
        errors.push(`${label} : le prix d'achat doit être un nombre strictement positif.`);
      }

      // Resolve the storage destination (optional). A structured unit + shelf is
      // preferred and drives the free-text `location`; otherwise fall back to any
      // free text, else mark the lot unassigned.
      let location = String(item.location ?? '').trim();
      let storageId: any;
      let shelf: string | undefined;
      if (item.storageId) {
        const storage = await Storage.findById(item.storageId);
        if (!storage) {
          errors.push(`${label} : unité de stockage introuvable.`);
        } else {
          const shelfName = item.shelf != null ? String(item.shelf) : '';
          if (shelfName && storage.shelves.length && !storage.shelves.includes(shelfName)) {
            errors.push(`${label} : l'étagère « ${shelfName} » n'existe pas dans « ${storage.name} ».`);
          } else {
            storageId = storage._id;
            shelf = shelfName || undefined;
            location = shelfName ? `${storage.name} / ${shelfName}` : storage.name;
          }
        }
      }
      if (!location) location = 'UNASSIGNED';

      if (med && Number.isInteger(qty) && qty > 0 && lotNumber && isFutureDate(item.expiry) && isPositivePrice(item.purchasePrice)) {
        prepared.push({ line, med, qty, lotNumber, expiry: item.expiry, location, storageId, shelf, purchasePrice: Number(item.purchasePrice) });
      }
    }
    if (errors.length) return res.status(400).json({ message: 'Validation échouée', errors });

    // Apply: a received lot + ledger entry per item.
    const summary: { medication: string; lotNumber: string; quantity: number; expiry: any }[] = [];
    for (const p of prepared) {
      const batch = await InventoryBatch.create({
        medicationId: p.med._id,
        batchNumber: p.lotNumber,
        expiry: p.expiry,
        quantity: p.qty,
        minStock: p.med.defaultMinStock,
        location: p.location,
        storageId: p.storageId,
        shelf: p.shelf,
        purchasePrice: p.purchasePrice,
        purchaseOrderId: order._id,
        status: 'active',
      });
      await StockMovement.create({
        itemId: batch._id, type: 'in', reason: 'receipt',
        quantity: p.qty, balanceAfter: p.qty, userId,
        note: `Livraison ${order.orderId}`,
      });
      // Keep the catalog reference buy price in sync with the latest received cost.
      if (p.med.purchasePrice !== p.purchasePrice) {
        p.med.purchasePrice = p.purchasePrice;
        await p.med.save();
      }
      p.line.receivedQuantity += p.qty;
      summary.push({ medication: p.med.name, lotNumber: p.lotNumber, quantity: p.qty, expiry: p.expiry });
    }

    const now = new Date();
    order.status = 'received';
    order.deliveredAt = now;
    if (!order.receivedAt) order.receivedAt = now;
    await order.save();

    const populated = await populatePO(PurchaseOrder.findById(order._id));
    res.json({ order: populated, summary });
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la confirmation de la livraison', error });
  }
};

export const cancelPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Commande d'achat introuvable" });
    if (order.status === 'received') {
      return res.status(400).json({ message: 'Une commande entièrement reçue ne peut pas être annulée' });
    }
    order.status = 'cancelled';
    await order.save();
    res.json(await populatePO(PurchaseOrder.findById(order._id)));
  } catch (error) {
    res.status(400).json({ message: "Erreur lors de l'annulation de la commande", error });
  }
};
