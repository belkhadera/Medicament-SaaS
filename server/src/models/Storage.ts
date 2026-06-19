import mongoose, { Schema, Document } from 'mongoose';

/**
 * A physical storage unit in the pharmacy, separated by environment type
 * (refrigerated, ambient, controlled-substance, quarantine). Each unit holds a
 * set of named shelves; inventory batches reference a unit + a shelf so their
 * physical location is structured rather than a free-text string.
 */
export type StorageType = 'cold' | 'ambient' | 'controlled' | 'quarantine' | 'general';

export interface IStorage extends Document {
  name: string;
  type: StorageType;
  shelves: string[];
  description?: string;
  minTemp?: number;
  maxTemp?: number;
}

const StorageSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: {
    type: String,
    enum: ['cold', 'ambient', 'controlled', 'quarantine', 'general'],
    required: true,
  },
  shelves: { type: [String], default: [] },
  description: { type: String },
  minTemp: { type: Number },
  maxTemp: { type: Number },
}, { timestamps: true });

export default mongoose.model<IStorage>('Storage', StorageSchema);
