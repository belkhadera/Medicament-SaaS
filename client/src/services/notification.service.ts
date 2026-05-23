import { api } from './api';

export interface AppNotification {
  _id: string;
  type: 'low_stock' | 'expiry' | 'out_of_stock' | 'order' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const notificationService = {
  getAll: () => api.get<AppNotification[]>('/notifications'),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  generateAlerts: () => api.post('/notifications/generate'),
};
