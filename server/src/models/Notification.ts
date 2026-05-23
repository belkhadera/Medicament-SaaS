import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  type: 'low_stock' | 'expiry' | 'out_of_stock' | 'order' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  type: {
    type: String,
    enum: ['low_stock', 'expiry', 'out_of_stock', 'order', 'system'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<INotification>('Notification', NotificationSchema);
