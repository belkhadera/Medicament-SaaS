import React, { useState } from "react";
import { Pill, Mail, Lock, Shield } from "lucide-react";
import { useAuth } from "../components/useAuth";

interface LoginScreenProps {
  onLogin: () => void;
  onForgotPassword: () => void;
  onRegister: () => void;
}

export function LoginScreen({
  onLogin,
  onForgotPassword,
  onRegister,
}: LoginScreenProps) {
  const { login, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState("sarah.j@hospital.com");
  const [password, setPassword] = useState("password123");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    try {
      await login({ email, password });
      onLogin();
    } catch (err: any) {
      const message = error || err.message || "Login failed";
      setLocalError(message);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-xl shadow-lg border border-border p-8"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
              <Pill className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              MediTrack Healthcare
            </h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          {displayError && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {displayError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hospital.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border"
                  disabled={isLoading}
                />
                <span className="text-sm text-muted-foreground">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-primary hover:underline"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={onRegister}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  Create one
                </button>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Secured with enterprise-grade encryption{" "}
              <Shield className="w-4 h-4 inline text-success" />
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
