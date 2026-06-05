import React from "react";
import { useAuth } from "./useAuth";

interface PrivateRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  fallback,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-4">
              Unauthorized - Please log in
            </p>
            <a href="/" className="text-primary hover:underline">
              Return to login
            </a>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};
