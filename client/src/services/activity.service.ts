import { api } from './api';

export interface Activity {
  _id: string;
  type: 'scan' | 'alert' | 'expiry' | 'order' | 'transfer' | 'create' | 'update' | 'delete';
  message: string;
  user: string;
  createdAt: string;
}

export const activityService = {
  getRecent: (limit = 10) => api.get<Activity[]>(`/activity?limit=${limit}`),
};
