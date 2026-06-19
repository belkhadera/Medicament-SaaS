/**
 * One-time, idempotent, NON-DESTRUCTIVE migration: split the single price into
 * the new two-price model so NO existing data is lost.
 *
 *   Medication.price      ->  Medication.salePrice
 *   InventoryBatch.unitPrice  ->  InventoryBatch.purchasePrice
 *                                 (falls back to the medication's price when a
 *                                  lot has no unitPrice of its own)
 *
 * The legacy `price` / `unitPrice` fields are LEFT IN PLACE as a backup. Only
 * documents that don't already have the new field are touched, so re-running is
 * safe. Reads/writes go through the native driver so legacy fields that the
 * (now-renamed) Mongoose schema no longer declares are still visible, and so
 * schema validators don't reject legacy zero-price rows.
 *
 * Run from the server/ directory:
 *   node --import tsx scripts/migratePriceSplit.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const meds = mongoose.connection.collection('medications');
  const batches = mongoose.connection.collection('inventorybatches');

  // 1. Medications: salePrice <- price.
  let medsUpdated = 0;
  const medSalePrice = new Map<string, number>(); // id -> sale price, for batch fallback
  const medCursor = meds.find({});
  for await (const m of medCursor) {
    const sale = m.salePrice ?? m.price ?? 0;
    medSalePrice.set(String(m._id), sale);
    if (m.salePrice === undefined || m.salePrice === null) {
      await meds.updateOne({ _id: m._id }, { $set: { salePrice: sale } });
      medsUpdated++;
    }
  }

  // 2. Batches: purchasePrice <- unitPrice (else the medication's price).
  let batchesUpdated = 0;
  const batchCursor = batches.find({});
  for await (const b of batchCursor) {
    if (b.purchasePrice !== undefined && b.purchasePrice !== null) continue;
    const fromMed = medSalePrice.get(String(b.medicationId)) ?? 0;
    const purchasePrice = b.unitPrice ?? fromMed ?? 0;
    await batches.updateOne({ _id: b._id }, { $set: { purchasePrice } });
    batchesUpdated++;
  }

  console.log('--- price-split migration summary ---');
  console.log(`  medications: ${medsUpdated} given a salePrice`);
  console.log(`  batches:     ${batchesUpdated} given a purchasePrice`);
  console.log(`  (legacy 'price' / 'unitPrice' fields left intact as backup)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
