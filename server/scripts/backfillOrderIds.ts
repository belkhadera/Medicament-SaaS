/**
 * Backfill `orderId` on purchase orders created before the scannable-QR feature.
 * Idempotent: only touches docs missing an orderId. Run this once after deploying
 * the new PurchaseOrder schema so the unique index has no null collisions.
 *
 *   node --import tsx scripts/backfillOrderIds.ts
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import PurchaseOrder from '../src/models/PurchaseOrder';

dotenv.config();

async function genOrderId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `ORD-${ts}-${rand}`;
    if (!(await PurchaseOrder.exists({ orderId: candidate }))) return candidate;
  }
  return `ORD-${crypto.randomUUID().toUpperCase()}`;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  // Use the raw collection so the `orderId: required` schema doesn't block the read.
  const missing = await PurchaseOrder.collection
    .find({ $or: [{ orderId: { $exists: false } }, { orderId: null }, { orderId: '' }] })
    .toArray();
  console.log(`Found ${missing.length} purchase order(s) without an orderId.`);

  let updated = 0;
  for (const po of missing) {
    const orderId = await genOrderId();
    await PurchaseOrder.collection.updateOne({ _id: po._id }, { $set: { orderId } });
    updated++;
  }

  console.log(`Backfilled ${updated} orderId(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
