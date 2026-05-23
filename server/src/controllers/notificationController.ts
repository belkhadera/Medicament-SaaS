import { Request, Response } from 'express';
import Notification from '../models/Notification';
import Inventory from '../models/Inventory';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const count = await Notification.countDocuments({ read: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count', error });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: 'Error updating notification', error });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications', error });
  }
};

export const generateAlerts = async (req: Request, res: Response) => {
  try {
    const inventory = await Inventory.find();
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const notifications: Array<{ type: string; title: string; message: string }> = [];

    for (const item of inventory) {
      if (item.stock > 0 && item.stock < item.minStock) {
        notifications.push({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${item.name} has only ${item.stock} units (minimum: ${item.minStock})`,
        });
      }
      if (item.stock === 0) {
        notifications.push({
          type: 'out_of_stock',
          title: 'Out of Stock',
          message: `${item.name} is completely out of stock`,
        });
      }
      const expiry = new Date(item.expiry);
      if (expiry <= now) {
        notifications.push({
          type: 'expiry',
          title: 'Expired Medication',
          message: `${item.name} (Batch: ${item.batch}) has expired`,
        });
      } else if (expiry <= in30Days) {
        notifications.push({
          type: 'expiry',
          title: 'Expiring Soon',
          message: `${item.name} (Batch: ${item.batch}) expires on ${expiry.toLocaleDateString()}`,
        });
      }
    }

    const created = await Notification.insertMany(notifications);
    res.json({ generated: created.length, notifications: created });
  } catch (error) {
    res.status(500).json({ message: 'Error generating alerts', error });
  }
};
