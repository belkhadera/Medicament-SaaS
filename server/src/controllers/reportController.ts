import { Request, Response } from 'express';
import StockMovement from '../models/StockMovement';

/**
 * Movement report — medicines entering and leaving stock, aggregated over time.
 *
 * Reads the append-only StockMovement ledger (the source of truth for every
 * stock change), joins each movement to its batch + catalog medication, and
 * buckets the rows by the requested granularity (daily / weekly / monthly /
 * yearly). Everything is derived at read time from real data; nothing is stored.
 *
 *   GET /api/reports/movements?granularity=monthly&from=ISO&to=ISO
 *
 * Value figures use the price that fits each direction:
 *   - valueIn  = Σ quantity × batch.purchasePrice   (cost of goods received)
 *   - valueOut = Σ quantity × medication.salePrice   (retail value dispensed)
 */

type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Default look-back window per granularity when the caller gives no range.
const DEFAULT_WINDOW_DAYS: Record<Granularity, number> = {
  daily: 30,
  weekly: 7 * 12,      // ~12 weeks
  monthly: 365,         // ~12 months
  yearly: 365 * 5,      // 5 years
};

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** Monday-based start of the ISO week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

/** Sortable key + human label for the bucket a date falls into. */
function bucketOf(d: Date, g: Granularity): { key: string; label: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  switch (g) {
    case 'daily': {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key, label: `${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}` };
    }
    case 'weekly': {
      const s = startOfWeek(d);
      const key = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
      return { key, label: `Sem. du ${String(s.getUTCDate()).padStart(2, '0')} ${MONTHS_FR[s.getUTCMonth()]}` };
    }
    case 'monthly':
      return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS_FR[m]} ${y}` };
    case 'yearly':
      return { key: `${y}`, label: `${y}` };
  }
}

interface Bucket {
  key: string;
  label: string;
  unitsIn: number;
  unitsOut: number;
  valueIn: number;
  valueOut: number;
  movements: number;
}

interface MedRow {
  name: string;
  category: string;
  unitsIn: number;
  unitsOut: number;
}

export const getMovementReport = async (req: Request, res: Response) => {
  try {
    const granularity = (['daily', 'weekly', 'monthly', 'yearly'] as Granularity[]).includes(
      req.query.granularity as Granularity,
    )
      ? (req.query.granularity as Granularity)
      : 'monthly';

    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date(to.getTime() - DEFAULT_WINDOW_DAYS[granularity] * MS_DAY);

    const movements = await StockMovement.find({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: 1 })
      .populate({
        path: 'itemId',
        select: 'batchNumber medicationId purchasePrice',
        populate: { path: 'medicationId', select: 'name category salePrice' },
      });

    const buckets = new Map<string, Bucket>();
    const meds = new Map<string, MedRow>();
    const totals = { unitsIn: 0, unitsOut: 0, valueIn: 0, valueOut: 0, movements: 0 };

    for (const mv of movements as any[]) {
      // Only true ins/outs count toward the flow report; 'adjust' corrections are
      // excluded from in/out totals (they re-balance, they don't move goods).
      if (mv.type !== 'in' && mv.type !== 'out') continue;

      const batch = mv.itemId as any;
      const med = batch?.medicationId as any;
      const qty: number = mv.quantity ?? 0;
      const purchasePrice: number = batch?.purchasePrice ?? 0;
      const salePrice: number = med?.salePrice ?? 0;

      const { key, label } = bucketOf(new Date(mv.createdAt), granularity);
      const b = buckets.get(key) ?? {
        key, label, unitsIn: 0, unitsOut: 0, valueIn: 0, valueOut: 0, movements: 0,
      };
      b.movements += 1;
      totals.movements += 1;

      const medName: string = med?.name ?? 'Inconnu';
      const medCat: string = med?.category ?? '—';
      const row = meds.get(medName) ?? { name: medName, category: medCat, unitsIn: 0, unitsOut: 0 };

      if (mv.type === 'in') {
        b.unitsIn += qty;
        b.valueIn += qty * purchasePrice;
        totals.unitsIn += qty;
        totals.valueIn += qty * purchasePrice;
        row.unitsIn += qty;
      } else {
        b.unitsOut += qty;
        b.valueOut += qty * salePrice;
        totals.unitsOut += qty;
        totals.valueOut += qty * salePrice;
        row.unitsOut += qty;
      }

      buckets.set(key, b);
      meds.set(medName, row);
    }

    const bucketList = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({
        ...b,
        valueIn: round2(b.valueIn),
        valueOut: round2(b.valueOut),
        net: b.unitsIn - b.unitsOut,
      }));

    const byMedication = [...meds.values()]
      .map((m) => ({ ...m, net: m.unitsIn - m.unitsOut }))
      .sort((a, b) => b.unitsOut + b.unitsIn - (a.unitsOut + a.unitsIn));

    res.json({
      granularity,
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        unitsIn: totals.unitsIn,
        unitsOut: totals.unitsOut,
        net: totals.unitsIn - totals.unitsOut,
        valueIn: round2(totals.valueIn),
        valueOut: round2(totals.valueOut),
        movements: totals.movements,
      },
      buckets: bucketList,
      byMedication,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la génération du rapport', error });
  }
};
