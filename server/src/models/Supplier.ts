import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  contact: string;
  phone: string;
  email?: string;
  status: 'active' | 'pending' | 'inactive';
  orders: number;
  rating: number;
  medicationIds: mongoose.Types.ObjectId[];
}

const SupplierSchema: Schema = new Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
  orders: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  medicationIds: [{ type: Schema.Types.ObjectId, ref: 'Medication' }],
}, { timestamps: true });

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
