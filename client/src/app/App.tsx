import React, { useState } from "react";
import { MainLayout } from "./layout/MainLayout";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { InventoryScreen } from "./screens/InventoryScreen";
import { AuthProvider } from "./components/AuthContext";
import { useAuth as useAuthHook } from "./components/useAuth";
import { PrivateRoute } from "./components/PrivateRoute";
import {
  ScanLine,
  Camera,
  Upload,
  CheckCircle,
  Pill,
  Clock,
  XCircle,
  AlertTriangle,
  BarChart3,
  FileText,
  Warehouse,
  Truck,
  Users as UsersIcon,
  Bell,
  Trash2,
  Eye,
  Edit,
  MoreVertical,
  Activity,
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Shield,
  Download,
  Filter,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { inventoryData, suppliers, users, chartData } from "./data/mockData";

type Screen =
  | "login"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "scanning"
  | "inventory"
  | "expiration"
  | "analytics"
  | "reports"
  | "storage"
  | "suppliers"
  | "users"
  | "notifications";

// Inner app component that uses auth context
function AppContent() {
  const { user, isAuthenticated, logout } = useAuthHook();
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [searchQuery, setSearchQuery] = useState("");

  // If not authenticated, show login/register screens
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
            onRegister={() => setCurrentScreen("dashboard")}
            onBackToLogin={() => setCurrentScreen("login")}
          />
        )}
        {currentScreen === "forgot-password" && (
          <ForgotPasswordScreen onBack={() => setCurrentScreen("login")} />
        )}
      </>
    );
  }

  // User is authenticated - show main app
  const handleLogout = async () => {
    await logout();
    setCurrentScreen("dashboard");
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
          <InventoryScreen searchQuery={searchQuery} />
        )}
        {currentScreen === "expiration" && <ExpirationScreen />}
        {currentScreen === "analytics" && <AnalyticsScreen />}
        {currentScreen === "reports" && <ReportsScreen />}
        {currentScreen === "storage" && <StorageScreen />}
        {currentScreen === "suppliers" && <SuppliersScreen />}
        {currentScreen === "users" && <UsersScreen />}
        {currentScreen === "notifications" && <NotificationsScreen />}
      </MainLayout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Keeping remaining screens here for now to keep the change focused,
// but they are now much easier to extract later.

function ScanningScreen() {
  const [scanning, setScanning] = useState(false);
  const [scannedMed, setScannedMed] = useState<any>(null);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScannedMed({
        name: "Amoxicillin 500mg",
        barcode: "8901234567890",
        manufacturer: "PharmaCorp",
        category: "Antibiotic",
        strength: "500mg",
        form: "Capsule",
      });
    }, 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Medication Scanning
        </h2>
        <p className="text-muted-foreground mt-1">
          Scan barcodes or QR codes to add medication to inventory
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Scanner
          </h3>
          <div
            className={`aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed ${scanning ? "border-primary animate-pulse" : "border-border"}`}
          >
            {scanning ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-foreground">
                  Scanning...
                </p>
              </div>
            ) : (
              <div className="text-center p-8">
                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-2">
                  Position barcode in frame
                </p>
                <p className="text-xs text-muted-foreground">
                  Camera will auto-detect medication
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-3">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ScanLine className="w-5 h-5" />
              {scanning ? "Scanning..." : "Start Scan"}
            </button>
            <button className="w-full border border-border py-3 rounded-lg font-medium hover:bg-accent flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Image
            </button>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Medication Information
          </h3>
          {scannedMed ? (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Scan Successful
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Medication detected and verified
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <InfoField label="Medication Name" value={scannedMed.name} />
                <InfoField label="Barcode" value={scannedMed.barcode} />
                <InfoField
                  label="Manufacturer"
                  value={scannedMed.manufacturer}
                />
                <InfoField label="Category" value={scannedMed.category} />
                <InfoField label="Strength" value={scannedMed.strength} />
                <InfoField label="Form" value={scannedMed.form} />
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <input
                  type="text"
                  placeholder="Batch Number"
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                />
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Storage Location"
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                />
              </div>

              <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Add to Inventory
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <ScanLine className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No medication scanned yet
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpirationScreen() {
  const expired = inventoryData.filter((i) => i.status === "expired");
  const expiring = inventoryData.filter((i) => i.status === "expiring");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Expiration Monitoring
        </h2>
        <p className="text-muted-foreground mt-1">
          Track and manage medication expiration dates
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard
          title="Expired"
          count={expired.length}
          description="Requires immediate action"
          variant="danger"
          icon={XCircle}
        />
        <AlertCard
          title="Expiring in 30 Days"
          count={expiring.length}
          description="Review and plan disposal"
          variant="warning"
          icon={Clock}
        />
        <AlertCard
          title="Expiring in 90 Days"
          count={28}
          description="Monitor closely"
          variant="info"
          icon={AlertTriangle}
        />
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Expired Medications
        </h3>
        <div className="space-y-3">
          {expired.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <Pill className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Batch: {item.batch} · Expired: {item.expiry}
                  </p>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm">
                Quarantine
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsScreen() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">
        Analytics Dashboard
      </h2>
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Medication Usage Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" stroke="#64748B" />
            <YAxis stroke="#64748B" />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="dispensed"
              stroke="#2563EB"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="received"
              stroke="#10B981"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReportsScreen() {
  return <div className="p-6">Reports Screen (Prototype)</div>;
}

function StorageScreen() {
  return <div className="p-6">Storage Units Screen (Prototype)</div>;
}

function SuppliersScreen() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Suppliers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((s) => (
          <div
            key={s.id}
            className="bg-card rounded-lg border border-border p-6"
          >
            <h3 className="text-lg font-semibold text-foreground">{s.name}</h3>
            <p className="text-sm text-muted-foreground">{s.contact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersScreen() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">
        User Management
      </h2>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase">
                User
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm font-medium">{u.name}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {u.role}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-success/10 text-success">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsScreen() {
  return <div className="p-6">Notifications Screen (Prototype)</div>;
}

// Minimal helper components kept here or moved to common
function InfoField({ label, value }: any) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AlertCard({ title, count, description, variant, icon: Icon }: any) {
  const variants = {
    danger: "bg-destructive/5 border-destructive/20 text-destructive",
    warning: "bg-warning/5 border-warning/20 text-warning",
    info: "bg-secondary/5 border-secondary/20 text-secondary",
  };

  return (
    <div
      className={`rounded-lg border p-6 ${variants[variant as keyof typeof variants]}`}
    >
      <Icon className="w-8 h-8 mb-4" />
      <h3 className="text-3xl font-bold mb-1">{count}</h3>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}
