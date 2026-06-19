/**
 * Inspect (and optionally merge) the Accu-Chek / Accu-Check duplicate caused by a
 * spelling typo. Run without flags to preview; add --apply to perform the merge.
 *
 * Merge = move the duplicate's batches onto the canonical medication, then remove
 * the duplicate catalog row. Batches keep their _id, so the ledger is unaffected.
 *
 *   node --import tsx scripts/mergeMedications.ts            # preview
 *   node --import tsx scripts/mergeMedications.ts --apply    # merge
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Medication from '../src/models/Medication';
import InventoryBatch from '../src/models/InventoryBatch';

dotenv.config();

const CANONICAL = 'Accu-Chek';   // correct brand spelling (kept)
const DUPLICATE = 'Accu-Check';  // typo (merged away)

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n`);

  const canonical = await Medication.findOne({ name: CANONICAL });
  const duplicate = await Medication.findOne({ name: DUPLICATE });

  for (const [label, med] of [['CANONICAL', canonical], ['DUPLICATE', duplicate]] as const) {
    if (!med) { console.log(`${label} "${label === 'CANONICAL' ? CANONICAL : DUPLICATE}" not found`); continue; }
    const batches = await InventoryBatch.find({ medicationId: med._id });
    const total = batches.reduce((s, b) => s + b.quantity, 0);
    console.log(`${label}: "${med.name}" id=${med._id} defaultMinStock=${med.defaultMinStock}`);
    console.log(`  batches=${batches.length} totalStock=${total} minStocks=${JSON.stringify(batches.map((b) => b.minStock))}`);
  }

  if (!canonical || !duplicate) {
    console.log('\nNothing to merge.');
    await mongoose.disconnect();
    return;
  }

  if (!process.argv.includes('--apply')) {
    console.log('\n(preview only — re-run with --apply to merge)');
    await mongoose.disconnect();
    return;
  }

  const res = await InventoryBatch.updateMany(
    { medicationId: duplicate._id },
    { $set: { medicationId: canonical._id } },
  );
  await Medication.deleteOne({ _id: duplicate._id });
  console.log(`\nMerged: moved ${res.modifiedCount} batch(es) to "${CANONICAL}" and removed "${DUPLICATE}".`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error('Merge failed:', err); process.exit(1); });
