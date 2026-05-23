import React from 'react';
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
import { chartData, categoryDistribution, recentActivity } from '../data/mockData';

export function DashboardScreen() {
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
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Medications"
          value="4,215"
          change="+12.5%"
          trend="up"
          icon={Pill}
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <KPICard
          title="Low Stock Alerts"
          value="8"
          change="+3"
          trend="up"
          icon={AlertTriangle}
          iconBg="bg-warning/10"
          iconColor="text-warning"
        />
        <KPICard
          title="Expiring Soon"
          value="15"
          change="-2"
          trend="down"
          icon={Clock}
          iconBg="bg-secondary/10"
          iconColor="text-secondary"
        />
        <KPICard
          title="Total Value"
          value="$284K"
          change="+8.2%"
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
            <button className="text-sm text-primary hover:underline">View Details</button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
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
            <button className="text-sm text-primary hover:underline">View All</button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryDistribution.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                <span className="text-sm text-muted-foreground">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
            <button className="text-sm text-primary hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'scan' ? 'bg-primary/10 text-primary' :
                  activity.type === 'alert' ? 'bg-warning/10 text-warning' :
                  activity.type === 'expiry' ? 'bg-destructive/10 text-destructive' :
                  activity.type === 'order' ? 'bg-success/10 text-success' :
                  'bg-secondary/10 text-secondary'
                }`}>
                  {activity.type === 'scan' && <ScanLine className="w-4 h-4" />}
                  {activity.type === 'alert' && <AlertTriangle className="w-4 h-4" />}
                  {activity.type === 'expiry' && <Clock className="w-4 h-4" />}
                  {activity.type === 'order' && <ShoppingCart className="w-4 h-4" />}
                  {activity.type === 'transfer' && <Package className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.user} · {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
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
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Stock Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatusCard label="Optimal Stock" count={3245} color="success" />
          <StatusCard label="Low Stock" count={85} color="warning" />
          <StatusCard label="Out of Stock" count={12} color="destructive" />
          <StatusCard label="Expiring Soon" count={28} color="secondary" />
          <StatusCard label="Expired" count={7} color="destructive" />
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, variant }: any) {
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

function StatusCard({ label, count, color }: any) {
  const colorClasses = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-2xl font-bold mb-1">{count}</p>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
