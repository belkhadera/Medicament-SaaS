/**
 * One-time, idempotent, NON-DESTRUCTIVE migration: set `storageCondition` on
 * every medication that doesn't have one yet, derived from its category via the
 * shared reference (lib/medicineReference). Medicines already carrying a valid
 * condition are left untouched, so re-running is safe.
 *
 *   cold        → vaccins, insulines, biologiques, sérums (2–8 °C)
 *   controlled  → stupéfiants, psychotropes, benzodiazépines (armoire sécurisée)
 *   ambient     → tout le reste (15–25 °C)
 *
 * Run from the server/ directory:
 *   node --import tsx scripts/setStorageConditions.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { conditionForCategory } from '../src/lib/medicineReference';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const meds = mongoose.connection.collection('medications');
  const valid = new Set(['cold', 'ambient', 'controlled']);

  let updated = 0;
  let kept = 0;
  const tally: Record<string, number> = { cold: 0, ambient: 0, controlled: 0 };

  const cursor = meds.find({});
  for await (const m of cursor) {
    if (valid.has(m.storageCondition)) {
      kept += 1;
      continue;
    }
    const condition = conditionForCategory(m.category ?? '');
    await meds.updateOne({ _id: m._id }, { $set: { storageCondition: condition } });
    tally[condition] += 1;
    updated += 1;
    console.log(`  • ${m.name} [${m.category ?? '—'}] → ${condition}`);
  }

  console.log(`\nDone. Updated ${updated}, already set ${kept}.`);
  console.log(`Breakdown: cold=${tally.cold}, ambient=${tally.ambient}, controlled=${tally.controlled}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
