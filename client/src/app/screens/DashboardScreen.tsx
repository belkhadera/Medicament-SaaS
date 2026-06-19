import { useMemo } from 'react';
import {
  Pill,
  AlertTriangle,
  Clock,
  DollarSign,
  ScanLine,
  XCircle,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { KPICard } from '../components/Dashboard/KPICard';
import { useInventory } from '../hooks/useInventory';
import { useMedications } from '../hooks/useMedications';
import { summarize, byCategory, formatCurrencyCompact, formatNumber, statusesFor, primaryStatus, STATUS_SEVERITY } from '../lib/inventoryStats';
import { StatusBadges } from '../components/common/StatusBadges';

/** Statuses (expiry + stock axes) for a dashboard row, stock judged on the whole medicine. */
const dashStatuses = (i: { stock: number; minStock: number; expiry: string; medicationTotal?: number }) =>
  statusesFor({ stock: i.medicationTotal ?? i.stock, minStock: i.minStock, expiry: i.expiry });

export function DashboardScreen() {
  const { data: inventory, loading, error } = useInventory();
  const { data: meds } = useMedications();

  const summary = useMemo(() => summarize(inventory), [inventory]);
  const categories = useMemo(() => byCategory(inventory), [inventory]);

  // Out-of-stock is a catalogue fact: an active medicine with 0 total stock. Its
  // lots are deleted once emptied, so it has no inventory rows for `summarize` to
  // count — derive the count from the catalogue instead.
  const outOfStock = useMemo(
    () => meds.filter((m) => m.isActive && (m.totalStock ?? 0) <= 0).length,
    [meds],
  );

  // Stock vs. minimum per category — a real, sourced chart.
  const stockByCategory = useMemo(() => {
    const map = new Map<string, { category: string; stock: number; minStock: number }>();
    for (const i of inventory) {
      const e = map.get(i.category) ?? { category: i.category, stock: 0, minStock: 0 };
      e.stock += i.stock;
      e.minStock += i.minStock;
      map.set(i.category, e);
    }
    return [...map.values()].sort((a, b) => b.stock - a.stock);
  }, [inventory]);

  // "Recent Activity" derived from the most urgent stocked lots. Each carries
  // every status that applies (e.g. expiring + low), sorted by the worst.
  const alerts = useMemo(() => {
    const sev = (i: typeof inventory[number]) => STATUS_SEVERITY.indexOf(primaryStatus(dashStatuses(i)));
    return inventory
      .filter((i) => i.stock > 0 && primaryStatus(dashStatuses(i)) !== 'optimal')
      .sort((a, b) => sev(a) - sev(b))
      .slice(0, 6);
  }, [inventory]);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full text-muted-foreground">Chargement du tableau de bord…</div>;
  }
  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Vue d'ensemble</h2>
          <p className="text-muted-foreground mt-1">Aperçu en temps réel de l'inventaire des médicaments</p>
        </div>
      </div>

      {/* KPI Cards — all computed from live inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total des médicaments" value={formatNumber(summary.totalItems)} icon={Pill} iconBg="bg-primary/10" iconColor="text-primary" />
        <KPICard title="Stock faible / Rupture" value={formatNumber(summary.lowStock + outOfStock)} icon={AlertTriangle} iconBg="bg-warning/10" iconColor="text-warning" />
        <KPICard title="Bientôt périmé" value={formatNumber(summary.expiringSoon)} icon={Clock} iconBg="bg-secondary/10" iconColor="text-secondary" />
        <KPICard title="Valeur totale du stock" value={formatCurrencyCompact(summary.totalValue)} icon={DollarSign} iconBg="bg-success/10" iconColor="text-success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground">Stock par catégorie</h3>
            <p className="text-sm text-muted-foreground mt-1">Unités actuelles vs seuil minimum</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stockByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="category" stroke="#64748B" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#64748B" />
              <Tooltip />
              <Legend />
              <Bar dataKey="stock" name="En stock" fill="#0d9488" radius={[4, 4, 0, 0]} />
              <Bar dataKey="minStock" name="Minimum requis" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground">Répartition par catégorie</h3>
            <p className="text-sm text-muted-foreground mt-1">Unités par type de médicament</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categories} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-sm text-muted-foreground">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Nécessite votre attention</h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tout est en ordre — aucune alerte.</p>
        ) : (
          <div className="space-y-4">
            {alerts.map((item) => {
              const sts = dashStatuses(item);
              const primary = primaryStatus(sts);
              return (
              <div key={item._id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    primary === 'expired' || primary === 'out'
                      ? 'bg-destructive/10 text-destructive'
                      : primary === 'expiring'
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-warning/10 text-warning'
                  }`}
                >
                  {primary === 'out' ? <XCircle className="w-4 h-4" /> : primary === 'low' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <StatusBadges statuses={sts} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.category} · Lot {item.batch} · {item.location}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stock Status Overview — live counts */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Aperçu de l'état du stock</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatusCard label="Stock optimal" count={summary.optimal} color="success" icon={Package} />
          <StatusCard label="Stock faible" count={summary.lowStock} color="warning" icon={AlertTriangle} />
          <StatusCard label="Rupture" count={outOfStock} color="destructive" icon={XCircle} />
          <StatusCard label="Bientôt périmé" count={summary.expiringSoon} color="secondary" icon={Clock} />
          <StatusCard label="Périmé" count={summary.expired} color="destructive" icon={ScanLine} />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string; icon?: unknown }) {
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
