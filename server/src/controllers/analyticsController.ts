import { Request, Response } from 'express';
import InventoryBatch, { IInventoryBatch } from '../models/InventoryBatch';
import Medication, { IMedication } from '../models/Medication';
import PurchaseOrder from '../models/PurchaseOrder';
import { deriveStatus } from '../lib/stockStatus';
import { totalStockByMedication } from '../lib/medicationStock';

const DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Per-medication profit margin, computed via a MongoDB aggregation over the live
 * batches. For each medication we take the quantity-weighted average purchase
 * price across its lots (cost can differ per delivery), join the catalog for the
 * sale price, and derive margin = salePrice − avgPurchasePrice. Only medications
 * that currently have stock are included.
 */
async function profitMargins() {
  return InventoryBatch.aggregate([
    {
      $group: {
        _id: '$medicationId',
        units: { $sum: '$quantity' },
        costValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } },
      },
    },
    { $match: { units: { $gt: 0 } } },
    { $lookup: { from: 'medications', localField: '_id', foreignField: '_id', as: 'med' } },
    { $unwind: '$med' },
    {
      $project: {
        _id: 0,
        name: '$med.name',
        category: '$med.category',
        salePrice: '$med.salePrice',
        avgPurchasePrice: { $divide: ['$costValue', '$units'] },
        margin: { $subtract: ['$med.salePrice', { $divide: ['$costValue', '$units'] }] },
      },
    },
    {
      $addFields: {
        marginPct: {
          $cond: [
            { $gt: ['$avgPurchasePrice', 0] },
            { $multiply: [{ $divide: ['$margin', '$avgPurchasePrice'] }, 100] },
            null,
          ],
        },
      },
    },
    { $sort: { margin: -1 } },
  ]);
}

/**
 * Dashboard / analytics metrics computed FROM BATCHES. Every figure is derived at
 * read time from the live `InventoryBatch` collection (joined to `Medication`) —
 * nothing is precomputed or stored, so it can't go stale.
 *
 * Two distinct valuations are reported, each using the price for its context:
 *   - stock value at COST   = Σ batch.purchasePrice × qty (what the stock cost)
 *   - stock value at SALE   = Σ med.salePrice    × qty (its retail worth)
 *   - potential profit      = sale − cost
 *
 * Status per batch uses the same priority as the rest of the app
 * (`deriveStatus`): expired > out > expiring (<=90d) > low (<minStock) > optimal.
 */
export const getAnalytics = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    const batches = await InventoryBatch.find()
      .populate<{ medicationId: IMedication }>('medicationId');

    let totalUnits = 0;
    let stockCostValue = 0;
    let stockSaleValue = 0;
    const statusCounts = { optimal: 0, low: 0, out: 0, expiring: 0, expired: 0 };
    const expiryBuckets = { expired: 0, within30: 0, within90: 0, ok: 0 };
    const unitsByCategory = new Map<string, number>();
    const valueByCategory = new Map<string, number>();
    const medIds = new Set<string>();

    for (const b of batches as (IInventoryBatch & { medicationId: IMedication | null })[]) {
      const med = b.medicationId;
      if (!med) continue; // skip orphaned batches
      medIds.add(String(med._id));

      const costValue = b.quantity * (b.purchasePrice ?? 0);
      const saleValue = b.quantity * (med.salePrice ?? 0);
      totalUnits += b.quantity;
      stockCostValue += costValue;
      stockSaleValue += saleValue;

      const status = deriveStatus({ stock: b.quantity, minStock: b.minStock, expiry: b.expiry });
      statusCounts[status] += 1;

      const days = Math.ceil((new Date(b.expiry).getTime() - now) / DAY);
      if (days < 0) expiryBuckets.expired += 1;
      else if (days <= 30) expiryBuckets.within30 += 1;
      else if (days <= 90) expiryBuckets.within90 += 1;
      else expiryBuckets.ok += 1;

      unitsByCategory.set(med.category, (unitsByCategory.get(med.category) ?? 0) + b.quantity);
      // Inventory value by category is reported at COST (the asset's book value).
      valueByCategory.set(med.category, (valueByCategory.get(med.category) ?? 0) + costValue);
    }

    // Out-of-stock is a CATALOG-level fact, not a batch one: a fully-consumed
    // medicine has its empty lot deleted, so it has no batch to count here.
    // Count active medications whose total on-hand stock is 0 instead.
    const activeMeds = await Medication.find({ isActive: true }).select('_id');
    const totals = await totalStockByMedication();
    const outOfStock = activeMeds.reduce(
      (n, m) => n + ((totals.get(String(m._id)) ?? 0) <= 0 ? 1 : 0),
      0,
    );

    // Order metrics — pending (draft/ordered/partial) vs delivered (received) vs
    // cancelled, via a MongoDB aggregation over the purchase orders.
    const orderRows = await PurchaseOrder.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = new Map(orderRows.map((r) => [r._id, r.count]));
    const orderCount = (s: string) => byStatus.get(s) ?? 0;
    const orders = {
      pending: orderCount('draft') + orderCount('ordered') + orderCount('partial'),
      delivered: orderCount('received'),
      cancelled: orderCount('cancelled'),
      total: orderRows.reduce((s, r) => s + r.count, 0),
    };

    // Profit-margin metric (MongoDB aggregation), plus a stock-weighted average.
    const margins = await profitMargins();
    const marginTotals = margins.reduce(
      (acc, m: any) => {
        acc.sale += m.salePrice;
        acc.cost += m.avgPurchasePrice;
        return acc;
      },
      { sale: 0, cost: 0 },
    );
    const avgMargin = margins.length ? (marginTotals.sale - marginTotals.cost) / margins.length : 0;
    const avgMarginPct = marginTotals.cost > 0 ? ((marginTotals.sale - marginTotals.cost) / marginTotals.cost) * 100 : 0;

    res.json({
      orders,
      summary: {
        totalItems: batches.length,        // batches (lots)
        totalMedications: medIds.size,      // distinct catalog products
        totalUnits,
        stockCostValue: round2(stockCostValue),   // value of stock at purchase cost
        stockSaleValue: round2(stockSaleValue),    // value of stock at sale price
        potentialProfit: round2(stockSaleValue - stockCostValue),
        lowStock: statusCounts.low,
        outOfStock,
        expiringSoon: statusCounts.expiring,
        expired: statusCounts.expired,
        optimal: statusCounts.optimal,
      },
      byCategory: [...unitsByCategory.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      valueByCategory: [...valueByCategory.entries()]
        .map(([category, value]) => ({ category, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value),
      margins: {
        avgMargin: round2(avgMargin),
        avgMarginPct: round2(avgMarginPct),
        items: margins.map((m: any) => ({
          name: m.name,
          category: m.category,
          salePrice: round2(m.salePrice),
          avgPurchasePrice: round2(m.avgPurchasePrice),
          margin: round2(m.margin),
          marginPct: m.marginPct == null ? null : round2(m.marginPct),
        })),
      },
      expiryBuckets,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du chargement des analyses', error });
  }
};
