import { api } from './api';

/** Stock & expiry metrics computed server-side from inventory batches. */
export interface AnalyticsSummary {
  totalItems: number;       // batches (lots)
  totalMedications: number; // distinct catalog products
  totalUnits: number;
  stockCostValue: number;   // Σ purchasePrice × qty (value at cost)
  stockSaleValue: number;   // Σ salePrice × qty (value at sale price)
  potentialProfit: number;  // stockSaleValue − stockCostValue
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  optimal: number;
}

/** Per-medication profit-margin row (salePrice − weighted avg purchase price). */
export interface MarginItem {
  name: string;
  category: string;
  salePrice: number;
  avgPurchasePrice: number;
  margin: number;
  marginPct: number | null;
}

export interface MarginMetrics {
  avgMargin: number;
  avgMarginPct: number;
  items: MarginItem[];
}

export interface OrderMetrics {
  pending: number;
  delivered: number;
  cancelled: number;
  total: number;
}

export interface Analytics {
  summary: AnalyticsSummary;
  orders: OrderMetrics;
  byCategory: { name: string; value: number }[];
  valueByCategory: { category: string; value: number }[];
  margins: MarginMetrics;
  expiryBuckets: { expired: number; within30: number; within90: number; ok: number };
}

export const analyticsService = {
  get: () => api.get<Analytics>('/analytics'),
};
