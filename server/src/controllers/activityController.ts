import { Request, Response } from 'express';
import ActivityLog from '../models/ActivityLog';

export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const activities = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity log', error });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const activity = new ActivityLog(req.body);
    const saved = await activity.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: 'Error creating activity', error });
  }
};
