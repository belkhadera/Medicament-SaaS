import mongoose, { Schema, Document } from 'mongoose';

export type MovementType = 'in' | 'out' | 'adjust';
export type MovementReason =
  | 'receipt'        // received against a purchase order (future)
  | 'scan_in'        // stocked in via the scanner / new item
  | 'dispense'       // removed from storage (sold / handed out)
  | 'expired'        // written off — expired
  | 'damaged'        // written off — damaged
  | 'correction';    // manual balance correction

/**
 * Append-only ledger of every change to an inventory item's stock. The item's
 * `stock` is the running balance; this records *why* it moved, by whom, and when.
 *
 * `itemId` references an InventoryBatch (the migration reuses the old Inventory
 * `_id` as the batch `_id`, so movements recorded before the catalog split still
 * resolve correctly).
 */
export interface IStockMovement extends Document {
  itemId: mongoose.Types.ObjectId;
  type: MovementType;
  reason: MovementReason;
  quantity: number;          // always positive; `type` carries the sign
  balanceAfter: number;      // item stock immediately after this movement
  userId?: mongoose.Types.ObjectId;
  note?: string;
}

const StockMovementSchema: Schema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch', required: true, index: true },
  type: { type: String, enum: ['in', 'out', 'adjust'], required: true },
  reason: {
    type: String,
    enum: ['receipt', 'scan_in', 'dispense', 'expired', 'damaged', 'correction'],
    required: true,
  },
  quantity: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  note: { type: String },
}, { timestamps: true });

export default mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
