import mongoose, { Schema, Document } from 'mongoose';

/**
 * A physical lot of a medication: its own batch number, expiry, location and
 * quantity. The "where/how much". Quantity is the running balance kept in sync
 * with the StockMovement ledger.
 *
 * `status` here is the physical lifecycle only. The display status the UI shows
 * (optimal / low / out / expiring / expired) is DERIVED from quantity + minStock
 * + expiry at read time — never stored — so it can't go stale.
 */
export interface IInventoryBatch extends Document {
  medicationId: mongoose.Types.ObjectId;
  batchNumber: string;           // lot number
  expiry: Date;                  // expiration date
  quantity: number;
  minStock: number;
  supplier?: string;             // free-text supplier for this physical lot
  receivedDate: Date;            // when the lot was received into stock
  location: string;
  storageId?: mongoose.Types.ObjectId;
  shelf?: string;
  purchasePrice: number;         // cost paid to the supplier for THIS lot
  purchaseOrderId?: mongoose.Types.ObjectId;
  status: 'active' | 'depleted' | 'expired' | 'quarantined';
}

const InventoryBatchSchema: Schema = new Schema({
  medicationId: { type: Schema.Types.ObjectId, ref: 'Medication', required: true, index: true },
  batchNumber: { type: String, required: true },
  expiry: {
    type: Date,
    required: true,
    index: true,
    // Future-dated only at CREATION; editing an already-expired lot stays allowed
    // (e.g. correcting a typo on a lot that has since expired).
    validate: {
      validator: function (this: any, value: Date): boolean {
        if (!this.isNew) return true;
        return value instanceof Date && !isNaN(value.getTime()) && value.getTime() > Date.now();
      },
      message: 'La date de péremption doit être dans le futur.',
    },
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    // A new lot must carry a positive whole number of units; existing lots may
    // deplete down to 0 over time (min: 0 above), but never become fractional.
    validate: {
      validator: function (this: any, value: number): boolean {
        if (!Number.isInteger(value)) return false;
        return this.isNew ? value > 0 : value >= 0;
      },
      message: 'La quantité doit être un entier positif.',
    },
  },
  minStock: { type: Number, required: true, default: 10 },
  supplier: { type: String },
  receivedDate: { type: Date, default: Date.now },
  location: { type: String, required: true },
  storageId: { type: Schema.Types.ObjectId, ref: 'Storage', index: true },
  shelf: { type: String },
  // Per-lot cost (can differ between deliveries). `min: 0` is the DB floor and
  // `default: 0` keeps legacy lots (created before this field) saveable; the API
  // enforces a strictly positive value when a lot is created/received.
  purchasePrice: { type: Number, required: true, min: 0, default: 0 },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  status: {
    type: String,
    enum: ['active', 'depleted', 'expired', 'quarantined'],
    default: 'active',
  },
}, { timestamps: true });

export default mongoose.model<IInventoryBatch>('InventoryBatch', InventoryBatchSchema);
