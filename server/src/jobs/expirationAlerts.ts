import InventoryBatch, { IInventoryBatch } from '../models/InventoryBatch';
import { IMedication } from '../models/Medication';
import { sendExpirationAlert } from '../modules/auth/email/emails';
import type {
  AlertDigest,
  ExpiryAlertRow,
  LowStockAlertRow,
} from '../modules/auth/email/expirationTemplates';

const DAY = 24 * 60 * 60 * 1000;

const expiryDays = (): number => Math.max(1, Number(process.env.ALERT_EXPIRY_DAYS) || 90);
const alertCron = (): string => process.env.ALERT_CRON || '0 8 * * *';
const alertTo = (): string => (process.env.ALERT_EMAIL_TO || '').trim();

/**
 * node-cron is loaded lazily so the server still compiles and boots if the
 * dependency hasn't been installed yet — the digest can always be triggered
 * manually via POST /api/inventory/alerts/run regardless.
 */
interface CronLike {
  schedule: (expr: string, fn: () => void) => unknown;
  validate: (expr: string) => boolean;
}
async function loadCron(): Promise<CronLike | null> {
  try {
    const spec = 'node-cron';
    const mod: any = await import(spec);
    return (mod?.default ?? mod) as CronLike;
  } catch {
    return null;
  }
}

export interface AlertSummary {
  expired: number;
  expiringSoon: number;
  lowStock: number;
  emailed: boolean;
  recipient?: string;
  skippedReason?: string;
}

/**
 * Scan every batch and bucket it into expired / expiring-soon / low-stock. Only
 * lots with stock are flagged for expiry; low-stock is `quantity < minStock`.
 * Returns the digest used to build the email — each expiry row carries the lot
 * number and its expiration date.
 */
export async function buildDigest(): Promise<AlertDigest> {
  const days = expiryDays();
  const now = Date.now();
  const threshold = now + days * DAY;

  const batches = await InventoryBatch.find()
    .populate<{ medicationId: IMedication }>('medicationId');

  const expired: ExpiryAlertRow[] = [];
  const expiringSoon: ExpiryAlertRow[] = [];
  const lowStock: LowStockAlertRow[] = [];

  for (const b of batches as (IInventoryBatch & { medicationId: IMedication | null })[]) {
    const med = b.medicationId;
    if (!med) continue; // skip orphaned batches defensively
    const medName = med.name;
    const expiryMs = new Date(b.expiry).getTime();
    const daysToExpiry = Math.ceil((expiryMs - now) / DAY);

    if (b.quantity > 0) {
      const row: ExpiryAlertRow = {
        medication: medName,
        lotNumber: b.batchNumber,
        expiry: b.expiry,
        quantity: b.quantity,
        daysToExpiry,
        location: b.location,
      };
      if (expiryMs < now) expired.push(row);
      else if (expiryMs <= threshold) expiringSoon.push(row);
    }

    if (b.quantity < b.minStock) {
      lowStock.push({
        medication: medName,
        lotNumber: b.batchNumber,
        quantity: b.quantity,
        minStock: b.minStock,
        location: b.location,
      });
    }
  }

  // Soonest expiry first; biggest shortfall first.
  expired.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  expiringSoon.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  lowStock.sort((a, b) => a.quantity - a.minStock - (b.quantity - b.minStock));

  return { expired, expiringSoon, lowStock, expiryDays: days, generatedAt: new Date() };
}

/**
 * Build the digest and email it if there is anything to report and a recipient
 * is configured. Returns a summary (also used by the manual-trigger endpoint).
 */
export async function runExpirationAlerts(): Promise<AlertSummary> {
  const digest = await buildDigest();
  const counts = {
    expired: digest.expired.length,
    expiringSoon: digest.expiringSoon.length,
    lowStock: digest.lowStock.length,
  };
  const total = counts.expired + counts.expiringSoon + counts.lowStock;
  const to = alertTo();

  if (total === 0) {
    return { ...counts, emailed: false, skippedReason: 'no_alerts' };
  }
  if (!to) {
    console.warn('⚠️  ALERT_EMAIL_TO is not set — skipping inventory alert email.');
    return { ...counts, emailed: false, skippedReason: 'no_recipient' };
  }

  await sendExpirationAlert(to, digest);
  console.log(`📧 Inventory alert sent to ${to} (${total} alert(s)).`);
  return { ...counts, emailed: true, recipient: to };
}

/** Schedule the daily digest. No-op (with a warning) when no recipient is set. */
export async function startExpirationAlerts(): Promise<void> {
  if (!alertTo()) {
    console.warn('⚠️  ALERT_EMAIL_TO is not set — expiry alert cron not started (use POST /api/inventory/alerts/run to test).');
    return;
  }
  const cron = await loadCron();
  if (!cron) {
    console.warn('⚠️  node-cron not installed — run `npm install` to enable scheduled alerts (manual trigger still works).');
    return;
  }
  const schedule = alertCron();
  if (!cron.validate(schedule)) {
    console.warn(`⚠️  Invalid ALERT_CRON "${schedule}" — expiry alerts not scheduled.`);
    return;
  }
  cron.schedule(schedule, () => {
    runExpirationAlerts().catch((err) => console.error('Expiry alert job failed:', err));
  });
  console.log(`⏰ Expiry/low-stock alerts scheduled (${schedule}) → ${alertTo()}`);
}
