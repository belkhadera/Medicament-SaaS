import React, { createContext, useState, useEffect, useCallback } from "react";
import {
  authService,
  User as AuthUser,
  RegisterResponse,
} from "../../services/auth.service";

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (credentials: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) => Promise<RegisterResponse>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<string>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  /** Replace the current user in context (e.g. after a profile edit). */
  updateUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const currentUser = authService.getCurrentUser();
        const accessToken = authService.getAccessToken();

        // If user exists and token exists, restore session
        if (currentUser && accessToken) {
          // Verify token is still valid by trying to refresh
          try {
            await authService.refreshToken();
            setUser(currentUser);
          } catch {
            // Refresh failed, clear session
            authService.logout();
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
        authService.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      try {
        setError(null);
        setIsLoading(true);
        const userData = await authService.login(credentials);
        setUser(userData);
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Login failed. Please check your credentials.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const register = useCallback(
    async (credentials: {
      name: string;
      email: string;
      password: string;
      role?: string;
    }) => {
      try {
        setError(null);
        setIsLoading(true);
        // Does NOT authenticate — the user must verify their email first.
        return await authService.register(credentials);
      } catch (err: any) {
        let message = "Registration failed. Please try again.";

        if (err.response?.data?.details) {
          // Handle Zod validation errors
          message = err.response.data.details
            .map((d: any) => d.message)
            .join(", ");
        } else if (err.response?.data?.message) {
          message = err.response.data.message;
        } else if (err.response?.data?.error) {
          message = err.response.data.error;
        }

        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const verifyEmail = useCallback(async (token: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const userData = await authService.verifyEmail(token);
      setUser(userData);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Email verification failed. The link may be invalid or expired.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    const { message } = await authService.resendVerification(email);
    return message;
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    const { message } = await authService.forgotPassword(email);
    return message;
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      setError(null);
      const { message } = await authService.resetPassword(token, password);
      return message;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      setError(null);
      await authService.refreshToken();
      const updatedUser = authService.getCurrentUser();
      setUser(updatedUser);
    } catch (err: any) {
      const message = err.message || "Token refresh failed";
      setError(message);
      // If refresh fails, logout user
      await logout();
      throw err;
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reflect a profile edit immediately in the UI. The session copy in
  // localStorage is kept in sync by authService.updateProfile.
  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    refreshToken,
    clearError,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
