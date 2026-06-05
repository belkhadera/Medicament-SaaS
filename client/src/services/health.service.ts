import { api } from './api';

export const healthService = {
  getStatus: () => api.get('/health'),
};
