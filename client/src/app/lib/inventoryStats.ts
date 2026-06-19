import { InventoryItem } from '../../services/inventory.service';

const DAY = 24 * 60 * 60 * 1000;

export const daysUntil = (date: string): number =>
  Math.ceil((new Date(date).getTime() - Date.now()) / DAY);

export const isExpired = (item: InventoryItem): boolean => daysUntil(item.expiry) < 0;

export const isExpiringWithin = (item: InventoryItem, days: number): boolean => {
  const d = daysUntil(item.expiry);
  return d >= 0 && d <= days;
};

export type InventoryStatus = InventoryItem['status'];

/**
 * Derive a coherent status from stock/expiry (same rules as the seed).
 * Priority: expired > out > expiring (<=90d) > low (< minStock) > optimal.
 */
export function computeStatus(input: { stock: number; minStock: number; expiry: string }): InventoryStatus {
  const d = daysUntil(input.expiry);
  if (d < 0) return 'expired';
  if (input.stock <= 0) return 'out';
  if (d <= 90) return 'expiring';
  if (input.stock < input.minStock) return 'low';
  return 'optimal';
}

/**
 * Statuses are two INDEPENDENT axes that can apply at once:
 *   - expiry axis : expired (< 0 d)  |  expiring (<= 90 d)  |  (none)
 *   - stock  axis : out (<= 0)       |  low (< minStock)    |  (none)
 * So a medicine can be e.g. "Bientôt périmé" + "Stock faible" simultaneously.
 * Returns the applicable statuses (expiry first, then stock), or ['optimal']
 * when nothing is abnormal. Used wherever a status is DISPLAYED; `computeStatus`
 * stays the single most-severe value for filtering/sorting.
 */
export function statusesFor(input: { stock: number; minStock: number; expiry: string }): InventoryStatus[] {
  const d = daysUntil(input.expiry);
  const list: InventoryStatus[] = [];
  if (d < 0) list.push('expired');
  else if (d <= 90) list.push('expiring');
  if (input.stock <= 0) list.push('out');
  else if (input.stock < input.minStock) list.push('low');
  return list.length ? list : ['optimal'];
}

/** Severity order (worst first) — for picking a single primary status. */
export const STATUS_SEVERITY: InventoryStatus[] = ['expired', 'out', 'expiring', 'low', 'optimal'];

/** The single most-severe status among a set (e.g. for filtering/sorting). */
export function primaryStatus(statuses: InventoryStatus[]): InventoryStatus {
  for (const s of STATUS_SEVERITY) if (statuses.includes(s)) return s;
  return 'optimal';
}

// Moroccan dirham (MAD), shown locally as "DH" with French number formatting
// (comma decimals, space thousands separator) — e.g. "1 234,56 DH".
const nfMAD = new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCurrency = (n: number): string => `${nfMAD.format(n)} DH`;

/** Compact dirham format for KPIs and chart axes — e.g. "1,2 k DH". */
export const formatCurrencyCompact = (n: number): string => {
  if (Math.abs(n) >= 1000) {
    return `${new Intl.NumberFormat('fr-MA', { notation: 'compact', maximumFractionDigits: 1 }).format(n)} DH`;
  }
  return `${nfMAD.format(n)} DH`;
};

export const formatNumber = (n: number): string => n.toLocaleString('fr-MA');

/** "2 min ago" / "3 hours ago" / "5 days ago" from an ISO date. */
export function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export interface InventorySummary {
  totalItems: number;
  totalUnits: number;
  totalValue: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number; // within 90 days, not expired
  expired: number;
  optimal: number;
}

export function summarize(items: InventoryItem[]): InventorySummary {
  const s: InventorySummary = {
    totalItems: items.length,
    totalUnits: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
    expired: 0,
    optimal: 0,
  };
  for (const i of items) {
    s.totalUnits += i.stock;
    // Stock value at cost (purchase price × quantity) — the inventory's book value.
    s.totalValue += i.stock * (i.purchasePrice ?? 0);
    if (i.status === 'low') s.lowStock += 1;
    else if (i.status === 'out') s.outOfStock += 1;
    else if (i.status === 'expiring') s.expiringSoon += 1;
    else if (i.status === 'expired') s.expired += 1;
    else s.optimal += 1;
  }
  return s;
}

const PALETTE = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

/** Total stock units grouped by category, with a stable color per slice. */
export function byCategory(items: InventoryItem[]): { name: string; value: number; color: string }[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.category, (map.get(i.category) ?? 0) + i.stock);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], idx) => ({ name, value, color: PALETTE[idx % PALETTE.length] }));
}

/** Items grouped by storage location/unit. */
export function byLocation(items: InventoryItem[]): { location: string; items: InventoryItem[]; units: number }[] {
  const map = new Map<string, InventoryItem[]>();
  for (const i of items) {
    const list = map.get(i.location) ?? [];
    list.push(i);
    map.set(i.location, list);
  }
  return [...map.entries()]
    .map(([location, list]) => ({
      location,
      items: list,
      units: list.reduce((sum, x) => sum + x.stock, 0),
    }))
    .sort((a, b) => a.location.localeCompare(b.location));
}

export const STATUS_META: Record<string, { label: string; class: string }> = {
  optimal: { label: 'Optimal', class: 'bg-success/10 text-success' },
  low: { label: 'Stock faible', class: 'bg-warning/10 text-warning' },
  out: { label: 'Rupture', class: 'bg-destructive/10 text-destructive' },
  expiring: { label: 'Bientôt périmé', class: 'bg-secondary/10 text-secondary' },
  expired: { label: 'Périmé', class: 'bg-destructive/10 text-destructive' },
};
