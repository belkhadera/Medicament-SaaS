import { api } from './api';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
  status: 'active' | 'inactive';
  lastActive: string;
}

export const userService = {
  getAll: () => api.get<UserProfile[]>('/users'),
  update: (id: string, data: Partial<UserProfile>) => api.put<UserProfile>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
