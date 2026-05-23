import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  RefreshCw, 
  Pill, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  ScanLine, 
  Plus, 
  FileText, 
  Upload, 
  ShoppingCart,
  Package
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { KPICard } from '../components/Dashboard/KPICard';
import {
  dashboardService,
  DashboardStats,
  CategoryDistribution,
  TrendData,
  StockStatus,
} from '../../services/dashboard.service';
import { activityService, Activity } from '../../services/activity.service';

export function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<CategoryDistribution[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [stockStatus, setStockStatus] = useState<StockStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, catRes, trendsRes, stockRes, actRes] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getCategoryDistribution(),
        dashboardService.getInventoryTrends(),
        dashboardService.getStockStatus(),
        activityService.getRecent(5),
      ]);
      setStats(statsRes.data);
      setCategories(catRes.data);
      setTrends(trendsRes.data);
      setStockStatus(stockRes.data);
      setActivities(actRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        Loading dashboard...
      </div>
    );
  }

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  };

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

  const activityIconMap: Record<string, React.ReactNode> = {
    scan: <ScanLine className="w-4 h-4" />,
    alert: <AlertTriangle className="w-4 h-4" />,
    expiry: <Clock className="w-4 h-4" />,
    order: <ShoppingCart className="w-4 h-4" />,
    transfer: <Package className="w-4 h-4" />,
    create: <Plus className="w-4 h-4" />,
    update: <RefreshCw className="w-4 h-4" />,
    delete: <AlertTriangle className="w-4 h-4" />,
  };

  const activityColorMap: Record<string, string> = {
    scan: 'bg-primary/10 text-primary',
    alert: 'bg-warning/10 text-warning',
    expiry: 'bg-destructive/10 text-destructive',
    order: 'bg-success/10 text-success',
    transfer: 'bg-secondary/10 text-secondary',
    create: 'bg-success/10 text-success',
    update: 'bg-primary/10 text-primary',
    delete: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground mt-1">Real-time medication inventory insights</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Last 30 days</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Medications"
          value={formatNumber(stats?.totalMedications ?? 0)}
          change={`${stats?.totalMedications ?? 0} units`}
          trend="up"
          icon={Pill}
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <KPICard
          title="Low Stock Alerts"
          value={String(stats?.lowStockAlerts ?? 0)}
          change={`${stats?.lowStockAlerts ?? 0} items`}
          trend={stats?.lowStockAlerts ? 'up' : 'down'}
          icon={AlertTriangle}
          iconBg="bg-warning/10"
          iconColor="text-warning"
        />
        <KPICard
          title="Expiring Soon"
          value={String(stats?.expiringSoon ?? 0)}
          change={`${stats?.expiringSoon ?? 0} items`}
          trend={stats?.expiringSoon ? 'up' : 'down'}
          icon={Clock}
          iconBg="bg-secondary/10"
          iconColor="text-secondary"
        />
        <KPICard
          title="Total Value"
          value={formatCurrency(stats?.totalValue ?? 0)}
          change="estimated"
          trend="up"
          icon={DollarSign}
          iconBg="bg-success/10"
          iconColor="text-success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Trends */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Inventory Trends</h3>
              <p className="text-sm text-muted-foreground mt-1">Monthly medication flow</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" stroke="#64748B" />
              <YAxis stroke="#64748B" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="dispensed" stroke="#2563EB" fillOpacity={1} fill="url(#colorDispensed)" />
              <Area type="monotone" dataKey="received" stroke="#10B981" fillOpacity={1} fill="url(#colorReceived)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Category Distribution</h3>
              <p className="text-sm text-muted-foreground mt-1">By medication type</p>
            </div>
          </div>
          {categories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-sm text-muted-foreground">{cat.name} ({cat.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No category data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          </div>
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity._id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activityColorMap[activity.type] || 'bg-muted text-muted-foreground'}`}>
                    {activityIconMap[activity.type] || <Package className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.user} · {getTimeAgo(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <QuickActionButton icon={ScanLine} label="Scan Medication" variant="primary" />
            <QuickActionButton icon={Plus} label="Add Inventory" variant="secondary" />
            <QuickActionButton icon={FileText} label="Generate Report" variant="secondary" />
            <QuickActionButton icon={Upload} label="Import Data" variant="secondary" />
            <QuickActionButton icon={ShoppingCart} label="New Order" variant="secondary" />
          </div>
        </div>
      </div>

      {/* Stock Status Overview */}
      {stockStatus && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Stock Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatusCard label="Optimal Stock" count={stockStatus.optimal} color="success" />
            <StatusCard label="Low Stock" count={stockStatus.low} color="warning" />
            <StatusCard label="Out of Stock" count={stockStatus.out} color="destructive" />
            <StatusCard label="Expiring Soon" count={stockStatus.expiringSoon} color="secondary" />
            <StatusCard label="Expired" count={stockStatus.expired} color="destructive" />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, variant }: { icon: React.ElementType; label: string; variant: string }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      variant === 'primary' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border hover:bg-accent'
    }`}>
      <Icon className="w-5 h-5" />
      <span className="text-sm">{label}</span>
      <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
    </button>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses: Record<string, string> = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color] || ''}`}>
      <p className="text-2xl font-bold mb-1">{count}</p>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
