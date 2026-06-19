import { useEffect, useState } from "react";
import { MainLayout } from "./layout/MainLayout";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { VerifyEmailScreen } from "./screens/VerifyEmailScreen";
import { VerifyPendingScreen } from "./screens/VerifyPendingScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { InventoryScreen } from "./screens/InventoryScreen";
import { MedicationsScreen } from "./screens/MedicationsScreen";
import { ScanningScreen } from "./screens/ScanningScreen";
import { ExpirationScreen } from "./screens/ExpirationScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { StorageScreen } from "./screens/StorageScreen";
import { SuppliersScreen } from "./screens/SuppliersScreen";
import { PurchasingScreen } from "./screens/PurchasingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { UsersScreen } from "./screens/UsersScreen";
import { Toaster } from "sonner";
import { AuthProvider } from "./components/AuthContext";
import { useAuth } from "./components/useAuth";
import { PrivateRoute } from "./components/PrivateRoute";

type Screen =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "verify-pending"
  | "dashboard"
  | "scanning"
  | "inventory"
  | "medications"
  | "purchasing"
  | "expiration"
  | "analytics"
  | "reports"
  | "storage"
  | "suppliers"
  | "profile"
  | "users";

// Email links land back on the SPA as `/?mode=verify-email&token=...` or
// `/?mode=reset-password&token=...`. Read those once on first render.
function readInitialRoute(): { screen: Screen; token: string } {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const token = params.get("token") ?? "";

  if (mode === "verify-email" && token) return { screen: "verify-email", token };
  if (mode === "reset-password" && token) return { screen: "reset-password", token };
  return { screen: "login", token: "" };
}

function clearUrlParams() {
  window.history.replaceState({}, "", window.location.pathname);
}

// Screens that only make sense when logged out.
const AUTH_SCREENS: Screen[] = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "verify-pending",
];

// Inner app component that uses auth context
function AppContent() {
  const { isAuthenticated, logout } = useAuth();
  const [initialRoute] = useState(readInitialRoute);
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialRoute.screen);
  const [emailToken] = useState(initialRoute.token);
  const [pendingEmail, setPendingEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Jump to the inventory screen pre-filtered to a medicine/lot (used by the
  // expiration alerts to "locate" a flagged item).
  const goToInventory = (query: string) => {
    setSearchQuery(query);
    setCurrentScreen("inventory");
  };

  // Jump to the catalogue pre-filtered to a medicine. Out-of-stock items no
  // longer live in inventory, so their alert routes here instead.
  const goToMedications = (query: string) => {
    setSearchQuery(query);
    setCurrentScreen("medications");
  };

  // Once authenticated (e.g. right after email verification), drop any token
  // from the URL and land on the dashboard instead of an auth-only screen.
  useEffect(() => {
    if (isAuthenticated) {
      clearUrlParams();
      if (AUTH_SCREENS.includes(currentScreen)) {
        setCurrentScreen("dashboard");
      }
    }
  }, [isAuthenticated, currentScreen]);

  // If not authenticated, show the auth screens
  if (!isAuthenticated) {
    return (
      <>
        {currentScreen === "login" && (
          <LoginScreen
            onLogin={() => setCurrentScreen("dashboard")}
            onForgotPassword={() => setCurrentScreen("forgot-password")}
            onRegister={() => setCurrentScreen("register")}
          />
        )}
        {currentScreen === "register" && (
          <RegisterScreen
            onRegister={(email) => {
              setPendingEmail(email);
              setCurrentScreen("verify-pending");
            }}
            onBackToLogin={() => setCurrentScreen("login")}
          />
        )}
        {currentScreen === "verify-pending" && (
          <VerifyPendingScreen
            email={pendingEmail}
            onBackToLogin={() => setCurrentScreen("login")}
          />
        )}
        {currentScreen === "forgot-password" && (
          <ForgotPasswordScreen onBack={() => setCurrentScreen("login")} />
        )}
        {currentScreen === "reset-password" && (
          <ResetPasswordScreen
            token={emailToken}
            onDone={() => {
              clearUrlParams();
              setCurrentScreen("login");
            }}
          />
        )}
        {currentScreen === "verify-email" && (
          <VerifyEmailScreen
            token={emailToken}
            onBackToLogin={() => {
              clearUrlParams();
              setCurrentScreen("login");
            }}
          />
        )}
      </>
    );
  }

  // User is authenticated - show main app
  const handleLogout = async () => {
    await logout();
    setCurrentScreen("login");
  };

  return (
    <PrivateRoute>
      <MainLayout
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {currentScreen === "dashboard" && <DashboardScreen />}
        {currentScreen === "scanning" && <ScanningScreen />}
        {currentScreen === "inventory" && (
          <InventoryScreen searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
        )}
        {currentScreen === "medications" && (
          <MedicationsScreen searchQuery={searchQuery} />
        )}
        {currentScreen === "expiration" && (
          <ExpirationScreen onLocate={goToInventory} onLocateCatalog={goToMedications} />
        )}
        {currentScreen === "analytics" && <AnalyticsScreen />}
        {currentScreen === "reports" && <ReportsScreen />}
        {currentScreen === "storage" && <StorageScreen />}
        {currentScreen === "suppliers" && <SuppliersScreen />}
        {currentScreen === "purchasing" && <PurchasingScreen />}
        {currentScreen === "profile" && <ProfileScreen />}
        {currentScreen === "users" && <UsersScreen />}
      </MainLayout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
