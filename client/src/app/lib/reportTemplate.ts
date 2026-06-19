import type { MovementReport } from "../../services/report.service";
import { formatCurrency, formatNumber } from "./inventoryStats";

/**
 * Build a printable movement report ("Rapport de mouvements") as a standalone
 * HTML document and open it in a print window, so the user can Save as PDF /
 * print it. Mirrors the purchase-order voucher approach in orderDocument.ts:
 * a self-contained document whose embedded onload handler triggers print().
 *
 * The report covers medicines entering and leaving stock over the chosen period
 * (daily / weekly / monthly / yearly), with a per-period breakdown and a
 * per-medication breakdown — all sourced from the live StockMovement ledger.
 */

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

export function buildReportHtml(report: MovementReport, granularityLabel: string): string {
  const periodRows = report.buckets
    .map(
      (b) => `<tr>
        <td>${esc(b.label)}</td>
        <td class="num pos">+${esc(formatNumber(b.unitsIn))}</td>
        <td class="num neg">−${esc(formatNumber(b.unitsOut))}</td>
        <td class="num">${esc(formatNumber(b.net))}</td>
        <td class="num">${esc(formatCurrency(b.valueIn))}</td>
        <td class="num">${esc(formatCurrency(b.valueOut))}</td>
      </tr>`,
    )
    .join("");

  const medRows = report.byMedication
    .map(
      (m) => `<tr>
        <td>${esc(m.name)}</td>
        <td>${esc(m.category)}</td>
        <td class="num pos">+${esc(formatNumber(m.unitsIn))}</td>
        <td class="num neg">−${esc(formatNumber(m.unitsOut))}</td>
        <td class="num">${esc(formatNumber(m.net))}</td>
      </tr>`,
    )
    .join("");

  const emptyPeriod = `<tr><td colspan="6" class="muted">Aucun mouvement sur cette période.</td></tr>`;
  const emptyMed = `<tr><td colspan="5" class="muted">Aucun mouvement sur cette période.</td></tr>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Rapport de mouvements — ${esc(granularityLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  .brand { font-size: 13px; font-weight: bold; color: #0d9488; letter-spacing: .5px; }
  .muted { color: #64748b; font-size: 13px; }
  .meta { margin-top: 14px; font-size: 14px; line-height: 1.7; }
  .meta b { display: inline-block; min-width: 130px; color: #334155; }
  .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; min-width: 150px; }
  .kpi .v { font-size: 18px; font-weight: bold; }
  .kpi .l { font-size: 11px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: left; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; }
  .pos { color: #047857; }
  .neg { color: #b45309; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { margin: 12mm; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="brand">MEDITRACK</div>
      <h1>Rapport de mouvements</h1>
      <div class="meta">
        <div><b>Granularité :</b> ${esc(granularityLabel)}</div>
        <div><b>Période :</b> ${esc(frDate(report.from))} – ${esc(frDate(report.to))}</div>
        <div><b>Généré le :</b> ${esc(new Date().toLocaleString("fr-FR"))}</div>
      </div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="v pos">${esc(formatNumber(report.totals.unitsIn))}</div><div class="l">Entrées (unités)</div></div>
    <div class="kpi"><div class="v neg">${esc(formatNumber(report.totals.unitsOut))}</div><div class="l">Sorties (unités)</div></div>
    <div class="kpi"><div class="v">${esc(formatNumber(report.totals.net))}</div><div class="l">Variation nette</div></div>
    <div class="kpi"><div class="v">${esc(formatCurrency(report.totals.valueIn))}</div><div class="l">Valeur entrées</div></div>
    <div class="kpi"><div class="v">${esc(formatCurrency(report.totals.valueOut))}</div><div class="l">Valeur sorties</div></div>
    <div class="kpi"><div class="v">${esc(formatNumber(report.totals.movements))}</div><div class="l">Mouvements</div></div>
  </div>

  <h2>Détail par période</h2>
  <table>
    <thead><tr>
      <th>Période</th><th class="num">Entrées</th><th class="num">Sorties</th>
      <th class="num">Net</th><th class="num">Valeur entrées</th><th class="num">Valeur sorties</th>
    </tr></thead>
    <tbody>${periodRows || emptyPeriod}</tbody>
    <tfoot><tr>
      <td>Total</td>
      <td class="num pos">+${esc(formatNumber(report.totals.unitsIn))}</td>
      <td class="num neg">−${esc(formatNumber(report.totals.unitsOut))}</td>
      <td class="num">${esc(formatNumber(report.totals.net))}</td>
      <td class="num">${esc(formatCurrency(report.totals.valueIn))}</td>
      <td class="num">${esc(formatCurrency(report.totals.valueOut))}</td>
    </tr></tfoot>
  </table>

  <h2>Détail par médicament</h2>
  <table>
    <thead><tr>
      <th>Médicament</th><th>Catégorie</th><th class="num">Entrées</th><th class="num">Sorties</th><th class="num">Net</th>
    </tr></thead>
    <tbody>${medRows || emptyMed}</tbody>
  </table>

  <div class="footer">Rapport généré par MediTrack le ${esc(new Date().toLocaleString("fr-FR"))} — données issues du registre des mouvements de stock.</div>

  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;
}

/** Open the report in a print window (Save as PDF from the browser dialog). */
export function printMovementReportDoc(report: MovementReport, granularityLabel: string): boolean {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.write(buildReportHtml(report, granularityLabel));
  w.document.close();
  return true;
}
