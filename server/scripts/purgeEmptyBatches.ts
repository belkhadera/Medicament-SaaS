/**
 * One-time cleanup: delete inventory batches whose quantity is 0 (or less).
 *
 * Per the current design, a lot is hard-deleted the moment it is fully consumed
 * (inventoryController.applyMovement), and the schema forbids creating a lot with
 * quantity 0. But LEGACY depleted lots — created/migrated before that rule, and
 * never moved since — can still linger in the database. Those empty rows make a
 * medicine report more lots/locations than it actually occupies (the catalogue
 * "lots / empl." count vs the locations pop-up disagree).
 *
 * This removes them. Their StockMovement history rows are kept (their `itemId`
 * simply becomes a dangling reference, as with any deleted lot). Idempotent —
 * re-running finds nothing once clean.
 *
 * Run from the server/ directory:
 *   node --import tsx scripts/purgeEmptyBatches.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const batches = mongoose.connection.collection('inventorybatches');

  const empties = await batches.find({ quantity: { $lte: 0 } }).toArray();
  if (empties.length === 0) {
    console.log('No empty lots found — nothing to purge.');
    await mongoose.disconnect();
    return;
  }

  for (const b of empties) {
    console.log(`  • deleting empty lot ${b.batchNumber ?? b._id} (qty ${b.quantity})`);
  }

  const { deletedCount } = await batches.deleteMany({ quantity: { $lte: 0 } });
  console.log(`\nDone. Purged ${deletedCount} empty lot(s).`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
