import mongoose from 'mongoose';
import InventoryBatch from '../models/InventoryBatch';

/**
 * Compute the total on-hand stock per medication as the SUM of its batch
 * quantities — never stored, always derived, so it can't go stale. Returns a
 * Map<medicationId(string), total>. Pass a list of ids to scope the aggregation
 * (e.g. a single page of the catalog); omit it to cover every medication.
 */
export async function totalStockByMedication(
  medIds?: (string | mongoose.Types.ObjectId)[],
): Promise<Map<string, number>> {
  const match: Record<string, any> = {};
  if (medIds && medIds.length) {
    match.medicationId = { $in: medIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  const rows = await InventoryBatch.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
    ...(medIds && medIds.length ? [{ $match: match }] : []),
    { $group: { _id: '$medicationId', total: { $sum: '$quantity' } } },
  ]);

  const map = new Map<string, number>();
  for (const r of rows) map.set(String(r._id), r.total);
  return map;
}

/** Convenience: total stock for a single medication (0 when it has no batches). */
export async function totalStockForMedication(
  medId: string | mongoose.Types.ObjectId,
): Promise<number> {
  const map = await totalStockByMedication([medId]);
  return map.get(String(medId)) ?? 0;
}
