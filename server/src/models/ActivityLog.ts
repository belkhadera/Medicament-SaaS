import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  type: 'scan' | 'alert' | 'expiry' | 'order' | 'transfer' | 'create' | 'update' | 'delete';
  message: string;
  user: string;
  relatedItem?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ActivityLogSchema: Schema = new Schema({
  type: {
    type: String,
    enum: ['scan', 'alert', 'expiry', 'order', 'transfer', 'create', 'update', 'delete'],
    required: true,
  },
  message: { type: String, required: true },
  user: { type: String, required: true },
  relatedItem: { type: Schema.Types.ObjectId, ref: 'Inventory' },
}, { timestamps: true });

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
