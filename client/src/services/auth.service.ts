import axios from 'axios';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const authService = {
  register: async (credentials: { name: string; email: string; password: string; role?: string }) => {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, credentials);
    if (response.data.accessToken) {
      authService.setSession(response.data);
    }
    return response.data.user;
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, credentials);
    if (response.data.accessToken) {
      authService.setSession(response.data);
    }
    return response.data.user;
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

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
    const token = localStorage.getItem('accessToken');
    const response = await axios.put<User>(
      `${API_BASE_URL}/auth/profile`, 
      userData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
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
    const token = localStorage.getItem('accessToken');
    const response = await axios.post(
      `${API_BASE_URL}/auth/change-password`, 
      { currentPassword, newPassword },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }
};
