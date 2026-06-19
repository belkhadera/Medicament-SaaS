/**
 * HTML template for the inventory expiry / low-stock digest email. Each expiry
 * row names the SPECIFIC lot number and its expiration date (not just the
 * medication), as required by the alert system.
 */

const BRAND = 'MediTrack Santé';
const PRIMARY = '#0d9488';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const BG = '#f3f4f6';
const DANGER = '#dc2626';
const WARN = '#d97706';

export interface ExpiryAlertRow {
  medication: string;
  lotNumber: string;
  expiry: Date;
  quantity: number;
  daysToExpiry: number;
  location: string;
}

export interface LowStockAlertRow {
  medication: string;
  lotNumber: string;
  quantity: number;
  minStock: number;
  location: string;
}

export interface AlertDigest {
  expired: ExpiryAlertRow[];
  expiringSoon: ExpiryAlertRow[];
  lowStock: LowStockAlertRow[];
  expiryDays: number;
  generatedAt: Date;
}

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('fr-FR');

function expiryTable(rows: ExpiryAlertRow[], accent: string): string {
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${TEXT};font-size:13px;">${r.medication}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${TEXT};font-size:13px;font-family:monospace;">${r.lotNumber}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${accent};font-size:13px;font-weight:600;">${fmtDate(r.expiry)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${MUTED};font-size:13px;">${r.daysToExpiry < 0 ? `il y a ${Math.abs(r.daysToExpiry)} j` : `dans ${r.daysToExpiry} j`}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${TEXT};font-size:13px;text-align:right;">${r.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${MUTED};font-size:13px;">${r.location || '—'}</td>
      </tr>`,
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Médicament</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Lot</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Péremption</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Échéance</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Qté</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Emplacement</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function lowStockTable(rows: LowStockAlertRow[]): string {
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${TEXT};font-size:13px;">${r.medication}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${TEXT};font-size:13px;font-family:monospace;">${r.lotNumber}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${DANGER};font-size:13px;font-weight:600;text-align:right;">${r.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${MUTED};font-size:13px;text-align:right;">${r.minStock}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;color:${MUTED};font-size:13px;">${r.location || '—'}</td>
      </tr>`,
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Médicament</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Lot</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Stock</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Seuil</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Emplacement</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function section(title: string, count: number, color: string, inner: string): string {
  if (count === 0) return '';
  return `
    <h2 style="margin:18px 0 4px;font-size:16px;color:${color};">${title} <span style="color:${MUTED};font-weight:500;">(${count})</span></h2>
    ${inner}`;
}

export function EXPIRATION_DIGEST_TEMPLATE(digest: AlertDigest): string {
  const total = digest.expired.length + digest.expiringSoon.length + digest.lowStock.length;
  return `
  <div style="margin:0;padding:0;background:${BG};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:${PRIMARY};color:#fff;font-size:26px;font-weight:700;">℞</div>
        <div style="margin-top:10px;font-size:18px;font-weight:600;color:${TEXT};">${BRAND}</div>
      </div>
      <div style="background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:${TEXT};">Alertes d'inventaire</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">
          ${total} alerte(s) au ${fmtDate(digest.generatedAt)} — lots périmés, péremption sous ${digest.expiryDays} jours, et stock faible.
        </p>
        ${section('Lots périmés', digest.expired.length, DANGER, expiryTable(digest.expired, DANGER))}
        ${section(`Péremption sous ${digest.expiryDays} jours`, digest.expiringSoon.length, WARN, expiryTable(digest.expiringSoon, WARN))}
        ${section('Stock faible', digest.lowStock.length, DANGER, lowStockTable(digest.lowStock))}
      </div>
      <p style="text-align:center;font-size:12px;color:${MUTED};margin-top:20px;line-height:1.6;">
        E-mail automatique généré par le suivi des péremptions ${BRAND}.
        <br/>© ${new Date().getFullYear()} ${BRAND}. Tous droits réservés.
      </p>
    </div>
  </div>`;
}
