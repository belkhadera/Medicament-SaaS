import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseOrderLine {
  medicationId: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;   // supports partial deliveries
}

export interface IPurchaseOrder extends Document {
  reference: string;          // human code e.g. "PO-2026-0001"
  orderId: string;            // scannable code e.g. "ORD-LXK2P9-7F3A" (QR payload)
  supplierId: mongoose.Types.ObjectId;
  lines: IPurchaseOrderLine[];
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
  totalCost: number;
  orderedAt?: Date;
  receivedAt?: Date;
  deliveredAt?: Date;         // set when the order is delivered (scan-confirmed)
  createdBy?: mongoose.Types.ObjectId;
}

const LineSchema = new Schema<IPurchaseOrderLine>({
  medicationId: { type: Schema.Types.ObjectId, ref: 'Medication', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, default: 0 },
  receivedQuantity: { type: Number, default: 0 },
}, { _id: false });

const PurchaseOrderSchema: Schema = new Schema({
  reference: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  lines: { type: [LineSchema], required: true },
  status: {
    type: String,
    enum: ['draft', 'ordered', 'partial', 'received', 'cancelled'],
    default: 'draft',
  },
  totalCost: { type: Number, default: 0 },
  orderedAt: { type: Date },
  receivedAt: { type: Date },
  deliveredAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
