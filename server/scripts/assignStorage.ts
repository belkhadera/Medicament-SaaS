/**
 * Assign every inventory batch to the storage unit adapted to its medication, and
 * create a new 'general' fallback unit for anything that matches no rule.
 *
 * Rules (first match wins):
 *   1. expired (expiry < today)          -> quarantine unit
 *   2. cold-chain (insulin / vaccine)    -> cold unit
 *   3. controlled (narcotics / benzos)   -> controlled unit
 *   4. everything else (shelf-stable)    -> ambient unit
 *   (no adapted unit of that type? -> general unit)
 *
 * Batches are spread round-robin across each unit's shelves, and `location` is
 * rewritten to "<unit> / <shelf>" so the UI stays coherent. Re-running is safe.
 *
 *   node --import tsx scripts/assignStorage.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Storage, { IStorage, StorageType } from '../src/models/Storage';
import InventoryBatch from '../src/models/InventoryBatch';
import Medication from '../src/models/Medication';

dotenv.config();

const COLD = /insulin|insuline|glargine|vaccin|vaccine/i;
const CONTROLLED = /tramadol|diaz[ée]pam|morphine|cod[ée]ine|fentanyl|oxycodone|zolpidem|alprazolam|loraz[ée]pam|p[ée]thidine|m[ée]thadone/i;

function classify(medName: string, expiry?: Date): StorageType {
  if (expiry && new Date(expiry).getTime() < Date.now()) return 'quarantine';
  if (COLD.test(medName)) return 'cold';
  if (CONTROLLED.test(medName)) return 'controlled';
  return 'ambient';
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n`);

  // Map each type to a unit (first unit of that type wins).
  const units = await Storage.find();
  const byType = new Map<StorageType, IStorage>();
  for (const u of units) if (!byType.has(u.type)) byType.set(u.type, u);

  // Ensure the new 'general' fallback unit exists.
  let general = byType.get('general');
  if (!general) {
    general = await Storage.create({
      name: 'Stock général',
      type: 'general',
      shelves: ['G1', 'G2', 'G3'],
      description: 'Médicaments non assignés à une unité spécialisée',
    });
    byType.set('general', general);
    console.log(`Created fallback unit "Stock général" [general]\n`);
  }

  const shelfCursor = new Map<string, number>(); // round-robin per unit
  const nextShelf = (u: IStorage): string | undefined => {
    if (!u.shelves.length) return undefined;
    const key = String(u._id);
    const i = shelfCursor.get(key) ?? 0;
    shelfCursor.set(key, i + 1);
    return u.shelves[i % u.shelves.length];
  };

  // Manual join (avoids populate model-registration quirks under tsx).
  const meds = await Medication.find({}, 'name').lean();
  const medName = new Map<string, string>(meds.map((m: any) => [String(m._id), m.name]));

  const batches = await InventoryBatch.find();
  const summary = new Map<string, number>();

  for (const b of batches) {
    const name = medName.get(String(b.medicationId));
    if (!name) continue;
    const type = classify(name, b.expiry);
    const unit = byType.get(type) ?? general!;
    const shelf = nextShelf(unit);

    b.storageId = unit._id as any;
    b.shelf = shelf;
    b.location = shelf ? `${unit.name} / ${shelf}` : unit.name;
    await b.save();

    const k = `${unit.name} [${unit.type}]`;
    summary.set(k, (summary.get(k) ?? 0) + 1);
  }

  console.log('--- assignment summary ---');
  for (const [k, n] of [...summary.entries()].sort()) console.log(`  ${k}: ${n} batch(es)`);
  console.log(`\nTotal batches assigned: ${batches.length}`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error('Assignment failed:', err); process.exit(1); });
