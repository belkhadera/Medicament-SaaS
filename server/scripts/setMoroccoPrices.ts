/**
 * Re-price the catalog for the Moroccan market.
 *
 * Sets each Medication.salePrice to the regulated public sale price (PPV, prix
 * public de vente, TTC) sourced from medicament.ma, and sets the purchasePrice
 * of that medication's active InventoryBatches to a realistic pharmacy buying
 * price (PPH, prix pharmacien — what the pharmacy pays the wholesaler). All
 * amounts are in MAD (dirham).
 *
 * The PPH is the wholesale cost the pharmacy pays; PPV − PPH is the regulated
 * pharmacist margin (regressive in Morocco: a larger % on cheap drugs, smaller
 * on expensive ones — reflected per row below).
 *
 * Matching is by active ingredient + strength, accent-insensitive, so it works
 * whether the catalog still holds the old English names or the translated French
 * ones (see scripts/translateData.ts). Unmatched catalog rows are reported, not
 * touched.
 *
 * Preview by default; pass --apply to write. Re-running is idempotent.
 *
 *   node --import tsx scripts/setMoroccoPrices.ts            # preview
 *   node --import tsx scripts/setMoroccoPrices.ts --apply    # write
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Medication from '../src/models/Medication';
import InventoryBatch from '../src/models/InventoryBatch';

dotenv.config();

/** Strip accents + lowercase so "Paracétamol"/"Paracetamol" both match. */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface PriceRow {
  /** Lowercase, accent-free substrings — ALL must be present in the med name. */
  match: string[];
  label: string;       // human-readable, for the report
  ppv: number;         // salePrice (MAD, TTC) — regulated public sale price
  pph: number;         // purchasePrice (MAD) — pharmacy buying / wholesale cost
}

// PPV figures are the medicament.ma public sale prices (June 2026). PPH is set
// from the regulated pharmacist margin (~30% on the cheapest drugs tapering to
// ~15% on the most expensive), rounded to a clean dirham amount.
const PRICES: PriceRow[] = [
  { match: ['amox'],                  label: 'Amoxicilline 500mg',   ppv: 32,   pph: 23 },
  { match: ['azithro'],               label: 'Azithromycine 250mg',  ppv: 62,   pph: 45 },
  { match: ['ciproflox'],             label: 'Ciprofloxacine 500mg', ppv: 95,   pph: 70 },
  { match: ['ibuprof'],               label: 'Ibuprofène 400mg',     ppv: 22,   pph: 15 },
  { match: ['paracetamol'],           label: 'Paracétamol 500mg',    ppv: 10,   pph: 7 },
  { match: ['naprox'],                label: 'Naproxène 250mg',      ppv: 35,   pph: 25 },
  { match: ['metform'],               label: 'Metformine 850mg',     ppv: 19,   pph: 13 },
  { match: ['insulin', 'glargine'],   label: 'Insuline glargine',    ppv: 744,  pph: 630 },
  { match: ['atorvastat'],            label: 'Atorvastatine 20mg',   ppv: 90,   pph: 72 },
  { match: ['omeprazol'],             label: 'Oméprazole 20mg',      ppv: 40,   pph: 28 },
  { match: ['ondansetron'],           label: 'Ondansétron 4mg',      ppv: 280,  pph: 230 },
  { match: ['levothyrox'],            label: 'Lévothyroxine 100mcg', ppv: 23,   pph: 16 },
  { match: ['salbutamol'],            label: 'Salbutamol inhalateur',ppv: 37,   pph: 27 },
  { match: ['montelukast'],           label: 'Montélukast 10mg',     ppv: 307,  pph: 250 },
  { match: ['cetirizin'],             label: 'Cétirizine 10mg',      ppv: 59,   pph: 43 },
  { match: ['diazep'],                label: 'Diazépam 5mg',         ppv: 12,   pph: 8 },
  { match: ['gabapentin'],            label: 'Gabapentine 300mg',    ppv: 287,  pph: 235 },
  { match: ['accu'],                  label: 'Accu-Chek bandelettes',ppv: 205,  pph: 150 },
  { match: ['tramadol'],              label: 'Tramadol 50mg',        ppv: 26,   pph: 19 },
  { match: ['gliclazid'],             label: 'Gliclazide 80mg',      ppv: 37,   pph: 27 },
  { match: ['amlodipin'],             label: 'Amlodipine 5mg',       ppv: 48,   pph: 35 },
  { match: ['bisoprolol'],            label: 'Bisoprolol 5mg',       ppv: 55,   pph: 40 },
  { match: ['clopidogrel'],           label: 'Clopidogrel 75mg',     ppv: 160,  pph: 125 },
  { match: ['pantoprazol'],           label: 'Pantoprazole 40mg',    ppv: 60,   pph: 44 },
  { match: ['prednisolon'],           label: 'Prednisolone 5mg',     ppv: 24,   pph: 17 },
  { match: ['loratadin'],             label: 'Loratadine 10mg',      ppv: 35,   pph: 26 },
];

function priceFor(name: string): PriceRow | undefined {
  const n = norm(name);
  return PRICES.find((p) => p.match.every((m) => n.includes(m)));
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const apply = process.argv.includes('--apply');

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}  (${apply ? 'APPLY' : 'PREVIEW'})\n`);

  const meds = await Medication.find({});
  let medsUpdated = 0, batchesUpdated = 0;
  const unmatched: string[] = [];

  for (const med of meds) {
    const row = priceFor(med.name);
    if (!row) { unmatched.push(med.name); continue; }

    const batches = await InventoryBatch.find({ medicationId: med._id, status: 'active' });
    console.log(
      `${med.name}  →  PPV ${row.ppv} / PPH ${row.pph} MAD  ` +
      `(margin ${row.ppv - row.pph}, ${Math.round((1 - row.pph / row.ppv) * 100)}%)  ` +
      `[${batches.length} active lot(s)]`,
    );

    if (apply) {
      if (med.salePrice !== row.ppv) {
        med.salePrice = row.ppv;
        await med.save();
        medsUpdated++;
      }
      for (const b of batches) {
        if (b.purchasePrice !== row.pph) {
          b.purchasePrice = row.pph;
          await b.save();
          batchesUpdated++;
        }
      }
    }
  }

  console.log('\n--- summary ---');
  console.log(`  catalog rows priced:   ${meds.length - unmatched.length} / ${meds.length}`);
  if (apply) {
    console.log(`  medications updated:   ${medsUpdated}`);
    console.log(`  batches updated:       ${batchesUpdated}`);
  } else {
    console.log('  (preview only — re-run with --apply to write)');
  }
  if (unmatched.length) {
    console.log(`  UNMATCHED (no price row, left untouched): ${JSON.stringify(unmatched)}`);
    console.log('  → add a PRICES entry for each and re-run.');
  }

  await mongoose.disconnect();
}

run().catch((err) => { console.error('Re-pricing failed:', err); process.exit(1); });
