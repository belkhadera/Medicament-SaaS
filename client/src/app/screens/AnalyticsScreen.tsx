import { useEffect, useMemo, useState } from 'react';
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
import { analyticsService, type Analytics } from '../../services/analytics.service';
import { formatCurrency, formatCurrencyCompact } from '../lib/inventoryStats';

const STATUS_COLORS: Record<string, string> = {
  'Optimal': '#10B981',
  'Faible': '#F59E0B',
  'Rupture': '#EF4444',
  'Bientôt': '#06B6D4',
  'Périmé': '#8B5CF6',
};

// Stable colour per category slice (mirrors the inventoryStats palette).
const PALETTE = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metrics are computed server-side FROM BATCHES (real API → MongoDB).
  useEffect(() => {
    analyticsService
      .get()
      .then((res) => setAnalytics(res.data))
      .catch(() => setError('Échec du chargement des analyses. Veuillez réessayer plus tard.'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => (analytics?.byCategory ?? []).map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length] })),
    [analytics],
  );
  const valueByCategory = analytics?.valueByCategory ?? [];

  const statusData = useMemo(() => {
    const s = analytics?.summary;
    if (!s) return [];
    return [
      { name: 'Optimal', value: s.optimal },
      { name: 'Faible', value: s.lowStock },
      { name: 'Rupture', value: s.outOfStock },
      { name: 'Bientôt', value: s.expiringSoon },
      { name: 'Périmé', value: s.expired },
    ].filter((d) => d.value > 0);
  }, [analytics]);

  // Top medications by unit profit margin (salePrice − weighted avg purchase price).
  const topMargins = useMemo(
    () => (analytics?.margins.items ?? []).slice(0, 10).map((m) => ({ ...m, name: m.name })),
    [analytics],
  );

  if (loading) return <div className="p-6 text-muted-foreground">Chargement des analyses…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Tableau de bord analytique</h2>
        <p className="text-muted-foreground mt-1">Indicateurs calculés à partir de l'inventaire en temps réel</p>
      </div>

      {/* Order metrics (MongoDB aggregation over purchase orders) */}
      {analytics?.orders && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OrderStat label="Commandes en attente" value={analytics.orders.pending} className="bg-warning/10 text-warning border-warning/20" />
          <OrderStat label="Commandes livrées" value={analytics.orders.delivered} className="bg-success/10 text-success border-success/20" />
          <OrderStat label="Commandes annulées" value={analytics.orders.cancelled} className="bg-destructive/10 text-destructive border-destructive/20" />
          <OrderStat label="Total des commandes" value={analytics.orders.total} className="bg-muted text-foreground border-border" />
        </div>
      )}

      {/* Value & profit metrics: stock at cost vs. at sale price, potential profit,
          and average per-unit margin (salePrice − purchasePrice). */}
      {analytics?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ValueStat label="Valeur du stock (coût)" value={formatCurrencyCompact(analytics.summary.stockCostValue)} />
          <ValueStat label="Valeur du stock (vente)" value={formatCurrencyCompact(analytics.summary.stockSaleValue)} />
          <ValueStat label="Profit potentiel" value={formatCurrencyCompact(analytics.summary.potentialProfit)} accent="text-success" />
          <ValueStat
            label="Marge moyenne / unité"
            value={`${formatCurrency(analytics.margins.avgMargin)}${analytics.margins.avgMarginPct ? ` · ${analytics.margins.avgMarginPct}%` : ''}`}
            accent="text-success"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Unités de stock par catégorie</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#64748B" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#64748B" />
              <Tooltip />
              <Bar dataKey="value" name="Unités" radius={[4, 4, 0, 0]}>
                {categories.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Articles par statut</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={(e) => `${e.name}: ${e.value}`}>
                {statusData.map((d, i) => (
                  <Cell key={i} fill={STATUS_COLORS[d.name] ?? '#94A3B8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Valeur de l'inventaire par catégorie (au coût)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={valueByCategory} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" stroke="#64748B" tickFormatter={(v) => formatCurrencyCompact(v)} />
            <YAxis type="category" dataKey="category" stroke="#64748B" width={120} fontSize={12} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="value" name="Valeur" fill="#0d9488" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Profit margin per medication (salePrice − weighted avg purchase price) */}
      {topMargins.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Marge unitaire par médicament (top 10)</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, topMargins.length * 36)}>
            <BarChart data={topMargins} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#64748B" tickFormatter={(v) => formatCurrencyCompact(v)} />
              <YAxis type="category" dataKey="name" stroke="#64748B" width={160} fontSize={12} />
              <Tooltip
                formatter={(v: number, _n, p: any) => {
                  const pct = p?.payload?.marginPct;
                  return [`${formatCurrency(v)}${pct != null ? ` (${pct}%)` : ''}`, 'Marge'];
                }}
              />
              <Bar dataKey="margin" name="Marge" radius={[0, 4, 4, 0]}>
                {topMargins.map((m, i) => (
                  <Cell key={i} fill={m.margin < 0 ? '#EF4444' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ValueStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <p className={`text-2xl font-bold mb-1 ${accent ?? 'text-foreground'}`}>{value}</p>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function OrderStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
