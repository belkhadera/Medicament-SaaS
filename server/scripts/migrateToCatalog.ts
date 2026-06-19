/**
 * One-time, idempotent, NON-DESTRUCTIVE migration: flat `inventories` -> catalog.
 *
 *   inventories[i]  ->  Medication (deduped by barcode, else name+category)
 *                   +   InventoryBatch (reusing the SAME _id as the old row)
 *                   +   opening StockMovement (if none exists and stock > 0)
 *
 * The original `inventories` collection is left untouched as a backup. Re-running
 * updates batches in place (keyed by _id) instead of duplicating them.
 *
 * Run from the server/ directory:
 *   node --import tsx scripts/migrateToCatalog.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Inventory from '../src/models/Inventory';
import Medication from '../src/models/Medication';
import InventoryBatch from '../src/models/InventoryBatch';
import StockMovement from '../src/models/StockMovement';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const items = await Inventory.find().lean();
  console.log(`Found ${items.length} flat inventory rows to migrate.`);

  let medsCreated = 0, medsReused = 0, batches = 0, openingMovements = 0;

  for (const inv of items as any[]) {
    // 1. Find or create the catalog entry (dedupe by barcode, else name+category).
    let med = inv.barcode
      ? await Medication.findOne({ barcode: inv.barcode })
      : await Medication.findOne({ name: inv.name, category: inv.category });

    if (!med) {
      med = await Medication.create({
        name: inv.name,
        category: inv.category,
        barcode: inv.barcode || undefined,
        defaultMinStock: inv.minStock ?? 10,
        // The old flat schema had a single `price`; seed the sale price from it.
        salePrice: inv.price ?? 0,
      });
      medsCreated++;
    } else {
      medsReused++;
    }

    // 2. Upsert the batch reusing the original _id (keeps frontend ids + any
    //    existing ledger entries valid). A flat row with no lot string gets a
    //    stable default so `batchNumber` (lot number) is never blank.
    const lotNumber = (inv.batch && String(inv.batch).trim())
      || `LOT-${String(inv._id).slice(-6).toUpperCase()}`;
    await InventoryBatch.updateOne(
      { _id: inv._id },
      {
        $set: {
          medicationId: med._id,
          batchNumber: lotNumber,
          expiry: inv.expiry,
          quantity: inv.stock ?? 0,
          minStock: inv.minStock ?? med.defaultMinStock,
          location: inv.location,
          // The single flat price becomes this lot's purchase (cost) price.
          purchasePrice: inv.price ?? 0,
          status: (inv.stock ?? 0) === 0 ? 'depleted' : 'active',
        },
        // Set once on first insert so re-running the migration is idempotent and
        // never rewrites a receivedDate that has since been edited. `supplier` is
        // intentionally left unset (the flat schema had none).
        $setOnInsert: {
          receivedDate: inv.createdAt ?? new Date(),
        },
      },
      { upsert: true },
    );
    batches++;

    // 3. Opening ledger entry (only if this batch has no movements yet).
    const existing = await StockMovement.countDocuments({ itemId: inv._id });
    if (existing === 0 && (inv.stock ?? 0) > 0) {
      await StockMovement.create({
        itemId: inv._id,
        type: 'in',
        reason: 'scan_in',
        quantity: inv.stock,
        balanceAfter: inv.stock,
        note: 'Opening balance (migration)',
      });
      openingMovements++;
    }
  }

  console.log('--- migration summary ---');
  console.log(`  medications: ${medsCreated} created, ${medsReused} reused`);
  console.log(`  batches:     ${batches} upserted`);
  console.log(`  opening movements: ${openingMovements} created`);
  console.log(`  (original 'inventories' collection left intact as backup)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
