import { api } from './api';

export interface Supplier {
  _id: string;
  name: string;
  contact: string;
  phone: string;
  status: 'active' | 'pending' | 'inactive';
  orders: number;
  rating: number;
}

export const supplierService = {
  getAll: () => api.get<Supplier[]>('/suppliers'),
  create: (data: Partial<Supplier>) => api.post<Supplier>('/suppliers', data),
  update: (id: string, data: Partial<Supplier>) => api.put<Supplier>(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};
