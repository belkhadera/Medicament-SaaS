import { Request, Response } from 'express';
import Inventory from '../models/Inventory';
import ActivityLog from '../models/ActivityLog';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const inventory = await Inventory.find();
    const totalMedications = inventory.reduce((sum, item) => sum + item.stock, 0);
    const lowStockCount = inventory.filter(i => i.stock > 0 && i.stock < i.minStock).length;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoonCount = inventory.filter(i => {
      const exp = new Date(i.expiry);
      return exp > now && exp <= in30Days;
    }).length;
    const totalValue = totalMedications * 67;

    res.json({
      totalMedications,
      lowStockAlerts: lowStockCount,
      expiringSoon: expiringSoonCount,
      totalValue,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error });
  }
};

export const getCategoryDistribution = async (req: Request, res: Response) => {
  try {
    const distribution = await Inventory.aggregate([
      { $group: { _id: '$category', value: { $sum: '$stock' } } },
      { $sort: { value: -1 } },
    ]);

    const colors = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#F97316', '#6366F1'];
    const result = distribution.map((item, index) => ({
      name: item._id,
      value: item.value,
      color: colors[index % colors.length],
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category distribution', error });
  }
};

export const getInventoryTrends = async (req: Request, res: Response) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trends = await Inventory.aggregate([
      {
        $match: { createdAt: { $gte: sixMonthsAgo } },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          received: { $sum: '$stock' },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNum = d.getMonth() + 1;
      const found = trends.find(t => t._id === monthNum);
      result.push({
        month: monthNames[d.getMonth()],
        received: found ? found.received : 0,
        dispensed: found ? Math.floor(found.received * 0.75) : 0,
        waste: found ? Math.floor(found.received * 0.03) : 0,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory trends', error });
  }
};

export const getStockStatusOverview = async (req: Request, res: Response) => {
  try {
    const inventory = await Inventory.find();
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const optimal = inventory.filter(i => i.stock >= i.minStock && new Date(i.expiry) > in30Days).length;
    const low = inventory.filter(i => i.stock > 0 && i.stock < i.minStock).length;
    const out = inventory.filter(i => i.stock === 0).length;
    const expiringSoon = inventory.filter(i => {
      const exp = new Date(i.expiry);
      return exp > now && exp <= in30Days;
    }).length;
    const expired = inventory.filter(i => new Date(i.expiry) <= now).length;

    res.json({ optimal, low, out, expiringSoon, expired });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stock status', error });
  }
};
