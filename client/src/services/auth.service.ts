import { api } from './api';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
  token: string;
}

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post<User>('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('user', JSON.stringify(response.data));
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
  },
  getCurrentUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },
  initAuth: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      api.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
      return user;
    }
    return null;
  }
};
