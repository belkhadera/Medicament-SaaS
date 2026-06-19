import mongoose, { Schema, Document } from 'mongoose';

/**
 * Catalog / product master — one row per distinct medication (keyed by barcode
 * when available). This is the "what". Physical stock lives in InventoryBatch,
 * which references this. The scanner autofills the static details from here.
 */
export interface IMedication extends Document {
  name: string;
  category: string;
  barcode?: string;
  dosageForm?: string;           // e.g. "Comprimé", "Sirop", "Injectable"
  strength?: string;             // e.g. "500mg", "10mg/ml"
  manufacturer?: string;         // labeller / brand owner
  defaultMinStock: number;
  salePrice: number;             // price charged when selling/dispensing (catalog-level)
  purchasePrice: number;         // reference buy/cost price used to pre-fill orders
  // Storage condition this medicine REQUIRES (derived from its category, can be
  // overridden): cold (2–8 °C), ambient (15–25 °C), or controlled (secure cabinet).
  storageCondition: 'cold' | 'ambient' | 'controlled';
  supplierIds: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const MedicationSchema: Schema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  barcode: { type: String, index: true },
  // Catalog detail surfaced by the scan "add new medication" flow. Optional so
  // rows migrated from the old flat schema (which had none) stay valid.
  dosageForm: { type: String },
  strength: { type: String },
  manufacturer: { type: String },
  defaultMinStock: { type: Number, required: true, default: 10 },
  // Sale price only. The cost paid to the supplier is captured per physical lot
  // (InventoryBatch.purchasePrice) since it can change between deliveries.
  // `min: 0`/`default: 0` are the DB-integrity floor and keep legacy rows
  // saveable; the API enforces a strictly positive value (see medicationController).
  salePrice: { type: Number, required: true, min: 0, default: 0 },
  // Catalog-level REFERENCE buy price — the last known cost, used to pre-fill the
  // unit price when creating a purchase order (so an out-of-stock medicine, which
  // has no batches, still suggests a cost). Kept in sync with the latest received
  // lot's `purchasePrice`; the ACTUAL per-delivery cost still lives on each
  // InventoryBatch (it can vary between deliveries). Optional (default 0) so
  // legacy/manually-created catalog rows stay valid.
  purchasePrice: { type: Number, min: 0, default: 0 },
  // Required storage condition. Defaults to 'ambient'; normally derived from the
  // category via lib/medicineReference at create/update time.
  storageCondition: {
    type: String,
    enum: ['cold', 'ambient', 'controlled'],
    default: 'ambient',
  },
  supplierIds: [{ type: Schema.Types.ObjectId, ref: 'Supplier' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IMedication>('Medication', MedicationSchema);
