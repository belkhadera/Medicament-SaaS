import { useEffect, useMemo, useState } from 'react';
import {
  FileText, Download, Printer, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, DollarSign, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  reportService, type Granularity, type MovementReport,
} from '../../services/report.service';
import { formatCurrency, formatNumber } from '../lib/inventoryStats';
import { printMovementReportDoc } from '../lib/reportTemplate';

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'yearly', label: 'Annuel' },
];

const fmtRange = (from: string, to: string) =>
  `${new Date(from).toLocaleDateString('fr-FR')} – ${new Date(to).toLocaleDateString('fr-FR')}`;

export function ReportsScreen() {
  const [granularity, setGranularity] = useState<Granularity>('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<MovementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportService
      .movements({ granularity, from: from || undefined, to: to || undefined })
      .then((res) => setReport(res.data))
      .catch(() => setError('Échec du chargement du rapport. Veuillez réessayer.'))
      .finally(() => setLoading(false));
  }, [granularity, from, to]);

  const chartData = useMemo(
    () => (report?.buckets ?? []).map((b) => ({ name: b.label, Entrées: b.unitsIn, Sorties: b.unitsOut })),
    [report],
  );

  const exportCsv = () => {
    if (!report) return;
    const header = ['Période', 'Entrées (u)', 'Sorties (u)', 'Net (u)', 'Valeur entrées (MAD)', 'Valeur sorties (MAD)', 'Mouvements'];
    const rows = report.buckets.map((b) => [b.label, b.unitsIn, b.unitsOut, b.net, b.valueIn, b.valueOut, b.movements]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-mouvements-${granularity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!report) return;
    const label = GRANULARITIES.find((g) => g.value === granularity)?.label ?? '';
    const ok = printMovementReportDoc(report, label);
    if (!ok) alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Rapports de mouvements</h2>
          <p className="text-muted-foreground mt-1">
            Suivi des entrées et sorties de médicaments — données en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={!report} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50">
            <Download className="w-4 h-4" />
            <span className="text-sm">CSV</span>
          </button>
          <button onClick={exportPdf} disabled={!report} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            <Printer className="w-4 h-4" />
            <span className="text-sm">Imprimer / PDF</span>
          </button>
        </div>
      </div>

      {/* Controls: granularity + optional custom range */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-lg p-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className={`px-4 py-2 text-sm transition-colors ${
                granularity === g.value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-muted-foreground">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
          <label className="text-sm text-muted-foreground">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} className="text-sm text-muted-foreground hover:text-foreground underline">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading && <div className="p-6 text-muted-foreground">Chargement du rapport…</div>}
      {error && <div className="p-6 text-destructive">{error}</div>}

      {report && !loading && (
        <>
          <p className="text-sm text-muted-foreground">Période couverte : {fmtRange(report.from, report.to)}</p>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat icon={ArrowDownToLine} label="Entrées (unités)" value={formatNumber(report.totals.unitsIn)} tone="success" />
            <Stat icon={ArrowUpFromLine} label="Sorties (unités)" value={formatNumber(report.totals.unitsOut)} tone="warning" />
            <Stat icon={TrendingUp} label="Variation nette" value={formatNumber(report.totals.net)} tone="primary" />
            <Stat icon={DollarSign} label="Valeur entrées" value={formatCurrency(report.totals.valueIn)} tone="success" />
            <Stat icon={DollarSign} label="Valeur sorties" value={formatCurrency(report.totals.valueOut)} tone="warning" />
            <Stat icon={Activity} label="Mouvements" value={formatNumber(report.totals.movements)} tone="primary" />
          </div>

          {/* In vs Out chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">Entrées vs Sorties par période</h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement sur cette période.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#64748B" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Entrées" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sorties" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Per-period breakdown */}
          <PeriodTable report={report} />

          {/* Per-medication breakdown */}
          <MedicationTable report={report} />
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    destructive: 'text-destructive bg-destructive/10',
  };
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PeriodTable({ report }: { report: MovementReport }) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Détail par période</h3>
        <span className="ml-auto text-xs text-muted-foreground">{report.buckets.length} période(s)</span>
      </div>
      {report.buckets.length === 0 ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">Aucun mouvement sur cette période.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-muted border-b border-border text-xs uppercase">
            <tr>
              <th className="px-6 py-3">Période</th>
              <th className="px-6 py-3 text-right">Entrées</th>
              <th className="px-6 py-3 text-right">Sorties</th>
              <th className="px-6 py-3 text-right">Net</th>
              <th className="px-6 py-3 text-right">Valeur entrées</th>
              <th className="px-6 py-3 text-right">Valeur sorties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.buckets.map((b) => (
              <tr key={b.key} className="hover:bg-muted/50">
                <td className="px-6 py-3 font-medium text-foreground">{b.label}</td>
                <td className="px-6 py-3 text-right text-success">+{formatNumber(b.unitsIn)}</td>
                <td className="px-6 py-3 text-right text-warning">−{formatNumber(b.unitsOut)}</td>
                <td className={`px-6 py-3 text-right font-medium ${b.net >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatNumber(b.net)}</td>
                <td className="px-6 py-3 text-right text-muted-foreground">{formatCurrency(b.valueIn)}</td>
                <td className="px-6 py-3 text-right text-muted-foreground">{formatCurrency(b.valueOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MedicationTable({ report }: { report: MovementReport }) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Détail par médicament</h3>
        <span className="ml-auto text-xs text-muted-foreground">{report.byMedication.length} médicament(s)</span>
      </div>
      {report.byMedication.length === 0 ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">Aucun mouvement sur cette période.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-muted border-b border-border text-xs uppercase">
            <tr>
              <th className="px-6 py-3">Médicament</th>
              <th className="px-6 py-3">Catégorie</th>
              <th className="px-6 py-3 text-right">Entrées</th>
              <th className="px-6 py-3 text-right">Sorties</th>
              <th className="px-6 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.byMedication.map((m) => (
              <tr key={m.name} className="hover:bg-muted/50">
                <td className="px-6 py-3 font-medium text-foreground">{m.name}</td>
                <td className="px-6 py-3 text-muted-foreground">{m.category}</td>
                <td className="px-6 py-3 text-right text-success">+{formatNumber(m.unitsIn)}</td>
                <td className="px-6 py-3 text-right text-warning">−{formatNumber(m.unitsOut)}</td>
                <td className={`px-6 py-3 text-right font-medium ${m.net >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatNumber(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
