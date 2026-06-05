import React, { createContext, useState, useEffect, useCallback } from "react";
import { authService, User as AuthUser } from "../../services/auth.service";

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
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
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
        const userData = await authService.register(credentials);
        setUser(userData);
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

  const logout = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      authService.logout();
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

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
