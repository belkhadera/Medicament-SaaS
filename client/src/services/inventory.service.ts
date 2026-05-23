import { api } from './api';

export interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  batch: string;
  stock: number;
  minStock: number;
  expiry: string;
  status: 'optimal' | 'low' | 'out' | 'expiring' | 'expired';
  location: string;
}


export const inventoryService = {
  getAll: () => api.get<InventoryItem[]>('/inventory'),
  create: (data: Partial<InventoryItem>) => api.post<InventoryItem>('/inventory', data),
  update: (id: string, data: Partial<InventoryItem>) => api.put<InventoryItem>(`/inventory/${id}`, data),
  delete: (id: string) => api.delete(`/inventory/${id}`),
};
// Note: real API calls are used via `api`. If you need a local mock,
// implement a separate mock module or modify this file to return
// hard-coded data when the backend is not available.