import { api } from './api';

export interface DashboardStats {
  totalMedications: number;
  lowStockAlerts: number;
  expiringSoon: number;
  totalValue: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
  color: string;
}

export interface TrendData {
  month: string;
  dispensed: number;
  received: number;
  waste: number;
}

export interface StockStatus {
  optimal: number;
  low: number;
  out: number;
  expiringSoon: number;
  expired: number;
}

export const dashboardService = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getCategoryDistribution: () => api.get<CategoryDistribution[]>('/dashboard/categories'),
  getInventoryTrends: () => api.get<TrendData[]>('/dashboard/trends'),
  getStockStatus: () => api.get<StockStatus>('/dashboard/stock-status'),
};
