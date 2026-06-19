import { IInventory } from '../models/Inventory';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Derive a coherent inventory status from stock + expiry. Mirrors the client's
 * computeStatus (client/src/app/lib/inventoryStats.ts) so server and UI never
 * disagree. Priority: expired > out > expiring (<=90d) > low (< minStock) > optimal.
 */
export function deriveStatus(input: { stock: number; minStock: number; expiry: Date }): IInventory['status'] {
  const days = Math.ceil((new Date(input.expiry).getTime() - Date.now()) / DAY);
  if (days < 0) return 'expired';
  if (input.stock <= 0) return 'out';
  if (days <= 90) return 'expiring';
  if (input.stock < input.minStock) return 'low';
  return 'optimal';
}
