import React, { useState, useEffect } from 'react';
import { MainLayout } from './layout/MainLayout';
import { LoginScreen } from './screens/LoginScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { authService, User as AuthUser } from '../services/auth.service';
import { inventoryService, InventoryItem } from '../services/inventory.service';
import { supplierService, Supplier } from '../services/supplier.service';
import { userService, UserProfile } from '../services/user.service';
import { dashboardService, TrendData } from '../services/dashboard.service';
import { notificationService, AppNotification } from '../services/notification.service';
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
  CheckCircle2,
  Star,
  MapPin,
  RefreshCw,
} from 'lucide-react';
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
  ResponsiveContainer
} from 'recharts';

type Screen =
  | 'login'
  | 'forgot-password'
  | 'dashboard'
  | 'scanning'
  | 'inventory'
  | 'expiration'
  | 'analytics'
  | 'reports'
  | 'storage'
  | 'suppliers'
  | 'users'
  | 'notifications';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const currentUser = authService.initAuth();
    if (currentUser) {
      setUser(currentUser);
      setCurrentScreen('dashboard');
    }
  }, []);

  const handleLogin = (userData: AuthUser) => {
    setUser(userData);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setCurrentScreen('login');
  };

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} onForgotPassword={() => setCurrentScreen('forgot-password')} />;
  }

  if (currentScreen === 'forgot-password') {
    return <ForgotPasswordScreen onBack={() => setCurrentScreen('login')} />;
  }

  return (
    <MainLayout
      currentScreen={currentScreen}
      onScreenChange={setCurrentScreen}
      onLogout={handleLogout}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {currentScreen === 'dashboard' && <DashboardScreen />}
      {currentScreen === 'scanning' && <ScanningScreen />}
      {currentScreen === 'inventory' && <InventoryScreen searchQuery={searchQuery} />}
      {currentScreen === 'expiration' && <ExpirationScreen />}
      {currentScreen === 'analytics' && <AnalyticsScreen />}
      {currentScreen === 'reports' && <ReportsScreen />}
      {currentScreen === 'storage' && <StorageScreen />}
      {currentScreen === 'suppliers' && <SuppliersScreen />}
      {currentScreen === 'users' && <UsersScreen />}
      {currentScreen === 'notifications' && <NotificationsScreen />}
    </MainLayout>
  );
}

function ScanningScreen() {
  const [scanning, setScanning] = useState(false);
  const [scannedMed, setScannedMed] = useState<{ name: string; barcode: string; manufacturer: string; category: string; strength: string; form: string } | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScannedMed({
        name: 'Amoxicillin 500mg',
        barcode: '8901234567890',
        manufacturer: 'PharmaCorp',
        category: 'Antibiotic',
        strength: '500mg',
        form: 'Capsule'
      });
    }, 2000);
  };

  const handleAddToInventory = async () => {
    if (!scannedMed || !batchNumber || !quantity || !expiryDate || !location) return;
    setAdding(true);
    setAddResult(null);
    try {
      const stock = parseInt(quantity);
      await inventoryService.create({
        name: scannedMed.name,
        category: scannedMed.category,
        batch: batchNumber,
        stock,
        minStock: Math.max(10, Math.floor(stock * 0.2)),
        expiry: expiryDate,
        status: 'optimal',
        location,
      });
      setAddResult('Medication added to inventory successfully!');
      setScannedMed(null);
      setBatchNumber('');
      setQuantity('');
      setExpiryDate('');
      setLocation('');
    } catch (err) {
      console.error('Failed to add to inventory:', err);
      setAddResult('Failed to add to inventory. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Medication Scanning</h2>
        <p className="text-muted-foreground mt-1">Scan barcodes or QR codes to add medication to inventory</p>
      </div>

      {addResult && (
        <div className={`p-3 rounded-lg text-sm ${addResult.includes('successfully') ? 'bg-success/10 border border-success/20 text-success' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
          {addResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Scanner</h3>
          <div className={`aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed ${scanning ? 'border-primary animate-pulse' : 'border-border'}`}>
            {scanning ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-foreground">Scanning...</p>
              </div>
            ) : (
              <div className="text-center p-8">
                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-2">Position barcode in frame</p>
                <p className="text-xs text-muted-foreground">Camera will auto-detect medication</p>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-3">
            <button onClick={handleScan} disabled={scanning} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              <ScanLine className="w-5 h-5" />
              {scanning ? 'Scanning...' : 'Start Scan'}
            </button>
            <button className="w-full border border-border py-3 rounded-lg font-medium hover:bg-accent flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Image
            </button>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Medication Information</h3>
          {scannedMed ? (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Scan Successful</p>
                  <p className="text-xs text-muted-foreground mt-1">Medication detected and verified</p>
                </div>
              </div>

              <div className="space-y-3">
                <InfoField label="Medication Name" value={scannedMed.name} />
                <InfoField label="Barcode" value={scannedMed.barcode} />
                <InfoField label="Manufacturer" value={scannedMed.manufacturer} />
                <InfoField label="Category" value={scannedMed.category} />
                <InfoField label="Strength" value={scannedMed.strength} />
                <InfoField label="Form" value={scannedMed.form} />
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <input type="text" placeholder="Batch Number" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" />
                <input type="number" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" />
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" />
                <input type="text" placeholder="Storage Location" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg" />
              </div>

              <button
                onClick={handleAddToInventory}
                disabled={adding || !batchNumber || !quantity || !expiryDate || !location}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {adding ? 'Adding...' : 'Add to Inventory'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <ScanLine className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No medication scanned yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpirationScreen() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await inventoryService.getAll();
        setInventory(res.data);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Loading expiration data...</div>;
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const expired = inventory.filter(i => new Date(i.expiry) <= now);
  const expiring30 = inventory.filter(i => {
    const exp = new Date(i.expiry);
    return exp > now && exp <= in30Days;
  });
  const expiring90 = inventory.filter(i => {
    const exp = new Date(i.expiry);
    return exp > in30Days && exp <= in90Days;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Expiration Monitoring</h2>
        <p className="text-muted-foreground mt-1">Track and manage medication expiration dates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard title="Expired" count={expired.length} description="Requires immediate action" variant="danger" icon={XCircle} />
        <AlertCard title="Expiring in 30 Days" count={expiring30.length} description="Review and plan disposal" variant="warning" icon={Clock} />
        <AlertCard title="Expiring in 90 Days" count={expiring90.length} description="Monitor closely" variant="info" icon={AlertTriangle} />
      </div>

      {expired.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Expired Medications</h3>
          <div className="space-y-3">
            {expired.map((item) => (
              <div key={item._id} className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <Pill className="w-6 h-6 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">Batch: {item.batch} · Expired: {new Date(item.expiry).toLocaleDateString()}</p>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm">Quarantine</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {expiring30.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Expiring Within 30 Days</h3>
          <div className="space-y-3">
            {expiring30.map((item) => (
              <div key={item._id} className="flex items-center justify-between p-4 border border-warning/20 bg-warning/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">Batch: {item.batch} · Expires: {new Date(item.expiry).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-warning/10 text-warning rounded text-sm font-medium">Expiring Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsScreen() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardService.getInventoryTrends();
        setTrends(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Loading analytics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Analytics Dashboard</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Medication Usage Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" stroke="#64748B" />
              <YAxis stroke="#64748B" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="dispensed" stroke="#2563EB" strokeWidth={2} />
              <Line type="monotone" dataKey="received" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Waste Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" stroke="#64748B" />
              <YAxis stroke="#64748B" />
              <Tooltip />
              <Legend />
              <Bar dataKey="waste" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ReportsScreen() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await inventoryService.getAll();
        setInventory(res.data);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Loading reports...</div>;
  }

  const totalItems = inventory.length;
  const totalStock = inventory.reduce((sum, i) => sum + i.stock, 0);
  const lowStock = inventory.filter(i => i.stock > 0 && i.stock < i.minStock);
  const outOfStock = inventory.filter(i => i.stock === 0);
  const now = new Date();
  const expired = inventory.filter(i => new Date(i.expiry) <= now);

  const handleExportCSV = () => {
    const headers = 'Name,Category,Batch,Stock,Min Stock,Expiry,Status,Location\n';
    const rows = inventory.map(i =>
      `"${i.name}","${i.category}","${i.batch}",${i.stock},${i.minStock},"${new Date(i.expiry).toLocaleDateString()}","${i.status}","${i.location}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Reports</h2>
          <p className="text-muted-foreground mt-1">Inventory summary and export</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Download className="w-4 h-4" />
          <span className="text-sm">Export CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-3xl font-bold text-foreground mt-2">{totalItems}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <p className="text-sm text-muted-foreground">Total Stock Units</p>
          <p className="text-3xl font-bold text-foreground mt-2">{totalStock.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <p className="text-sm text-muted-foreground">Low Stock Items</p>
          <p className="text-3xl font-bold text-warning mt-2">{lowStock.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <p className="text-sm text-muted-foreground">Out of Stock</p>
          <p className="text-3xl font-bold text-destructive mt-2">{outOfStock.length}</p>
        </div>
      </div>

      {expired.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Expired Items ({expired.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase">Batch</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase">Expiry</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expired.map(i => (
                  <tr key={i._id}>
                    <td className="px-4 py-3 text-sm">{i.name}</td>
                    <td className="px-4 py-3 text-sm font-mono">{i.batch}</td>
                    <td className="px-4 py-3 text-sm text-destructive">{new Date(i.expiry).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">{i.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StorageScreen() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await inventoryService.getAll();
        setInventory(res.data);
      } catch (err) {
        console.error('Failed to fetch storage data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Loading storage units...</div>;
  }

  const locationGroups: Record<string, InventoryItem[]> = {};
  inventory.forEach(item => {
    const loc = item.location || 'Unassigned';
    if (!locationGroups[loc]) locationGroups[loc] = [];
    locationGroups[loc].push(item);
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Storage Units</h2>
        <p className="text-muted-foreground mt-1">View medications organized by storage location</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(locationGroups).map(([loc, items]) => (
          <div key={loc} className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Location {loc}</h3>
                <p className="text-xs text-muted-foreground">{items.length} medication{items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item._id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">{item.stock} units</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await supplierService.getAll();
        setSuppliers(res.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
        setError('Failed to load suppliers.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-full">Loading suppliers...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Suppliers</h2>
        <span className="text-sm text-muted-foreground">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map(s => (
          <div key={s._id} className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">{s.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                s.status === 'active' ? 'bg-success/10 text-success' :
                s.status === 'pending' ? 'bg-warning/10 text-warning' :
                'bg-muted text-muted-foreground'
              }`}>
                {s.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{s.contact}</p>
            <p className="text-sm text-muted-foreground mb-3">{s.phone}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{s.orders} orders</span>
              <span className="flex items-center gap-1 text-warning">
                <Star className="w-4 h-4 fill-current" />
                {s.rating.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await userService.getAll();
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-full">Loading users...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">User Management</h2>
        <span className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase">User</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">Email</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">Role</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map(u => (
              <tr key={u._id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm font-medium">{u.name}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{u.role}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    u.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>{u.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{getTimeAgo(u.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getAll();
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleGenerateAlerts = async () => {
    setGenerating(true);
    try {
      await notificationService.generateAlerts();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to generate alerts:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-6 flex items-center justify-center h-full">Loading notifications...</div>;

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeIcons: Record<string, React.ReactNode> = {
    low_stock: <AlertTriangle className="w-5 h-5 text-warning" />,
    expiry: <Clock className="w-5 h-5 text-destructive" />,
    out_of_stock: <XCircle className="w-5 h-5 text-destructive" />,
    order: <ShoppingCart className="w-5 h-5 text-primary" />,
    system: <Bell className="w-5 h-5 text-muted-foreground" />,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Notifications</h2>
          <p className="text-muted-foreground mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateAlerts}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span className="text-sm">{generating ? 'Generating...' : 'Generate Alerts'}</span>
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No notifications yet. Click "Generate Alerts" to scan for issues.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div
              key={n._id}
              className={`bg-card rounded-lg border p-4 flex items-start gap-4 ${n.read ? 'border-border opacity-60' : 'border-primary/30'}`}
            >
              <div className="mt-0.5">{typeIcons[n.type] || <Bell className="w-5 h-5" />}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => handleMarkAsRead(n._id)}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AlertCard({ title, count, description, variant, icon: Icon }: { title: string; count: number; description: string; variant: string; icon: React.ElementType }) {
  const variants: Record<string, string> = {
    danger: 'bg-destructive/5 border-destructive/20 text-destructive',
    warning: 'bg-warning/5 border-warning/20 text-warning',
    info: 'bg-secondary/5 border-secondary/20 text-secondary',
  };

  return (
    <div className={`rounded-lg border p-6 ${variants[variant] || ''}`}>
      <Icon className="w-8 h-8 mb-4" />
      <h3 className="text-3xl font-bold mb-1">{count}</h3>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}
