import axios from 'axios';
import { api } from './api';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
  isEmailVerified?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export interface MessageResponse {
  message: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const authService = {
  // Registration no longer logs the user in: the account must be verified via
  // the email link first. Returns the server's confirmation message.
  register: async (credentials: { name: string; email: string; password: string; role?: string }) => {
    const response = await api.post<RegisterResponse>('/auth/register', credentials);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.accessToken) {
      authService.setSession(response.data);
    }
    return response.data.user;
  },

  // Confirms the email verification token and logs the user in (server returns
  // tokens on success so the user lands straight in the app).
  verifyEmail: async (token: string) => {
    const response = await api.get<AuthResponse>('/auth/verify-email', { params: { token } });
    if (response.data.accessToken) {
      authService.setSession(response.data);
    }
    return response.data.user;
  },

  resendVerification: async (email: string) => {
    const response = await api.post<MessageResponse>('/auth/resend-verification', { email });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post<MessageResponse>('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await api.post<MessageResponse>('/auth/reset-password', { token, password });
    return response.data;
  },

  logout: async () => {
    try {
      // Best-effort server-side refresh-token invalidation; ignore failures so
      // the client always clears its local session.
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      // Use raw axios (not the shared `api` instance) so a 401 here does not
      // re-trigger the response interceptor's refresh logic and cause a loop.
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      return response.data;
    } catch (error) {
      authService.logout();
      throw error;
    }
  },

  setSession: (authData: AuthResponse) => {
    localStorage.setItem('user', JSON.stringify(authData.user));
    localStorage.setItem('accessToken', authData.accessToken);
    localStorage.setItem('refreshToken', authData.refreshToken);
  },

  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  initAuth: () => {
    const accessToken = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (accessToken && userStr) {
      return JSON.parse(userStr);
    }
    return null;
  },

  updateProfile: async (userData: { name?: string; email?: string; password?: string }) => {
    const response = await api.put<User>('/auth/profile', userData);
    if (response.data) {
      const user = authService.getCurrentUser();
      if (user) {
        const updatedUser = { ...user, ...response.data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    }
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }
};
