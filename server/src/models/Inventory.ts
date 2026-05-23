import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
  name: string;
  category: string;
  batch: string;
  stock: number;
  minStock: number;
  expiry: Date;
  status: 'optimal' | 'low' | 'out' | 'expiring' | 'expired';
  location: string;
}

const InventorySchema: Schema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  batch: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  minStock: { type: Number, required: true, default: 10 },
  expiry: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['optimal', 'low', 'out', 'expiring', 'expired'],
    default: 'optimal'
  },
  location: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IInventory>('Inventory', InventorySchema);
