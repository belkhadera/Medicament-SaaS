import { Request, Response } from 'express';
import Inventory from '../models/Inventory';
import ActivityLog from '../models/ActivityLog';

export const getAllInventory = async (req: Request, res: Response) => {
  try {
    const inventory = await Inventory.find().sort({ createdAt: -1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error });
  }
};

export const createInventory = async (req: any, res: Response) => {
  try {
    const newInventory = new Inventory(req.body);
    const savedInventory = await newInventory.save();

    await ActivityLog.create({
      type: 'create',
      message: `${savedInventory.name} added to inventory (${savedInventory.stock} units)`,
      user: req.user?.name || 'System',
      relatedItem: savedInventory._id,
    });

    res.status(201).json(savedInventory);
  } catch (error) {
    res.status(400).json({ message: 'Error creating inventory', error });
  }
};

export const updateInventory = async (req: any, res: Response) => {
  try {
    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedInventory) return res.status(404).json({ message: 'Inventory not found' });

    await ActivityLog.create({
      type: 'update',
      message: `${updatedInventory.name} inventory updated`,
      user: req.user?.name || 'System',
      relatedItem: updatedInventory._id,
    });

    res.json(updatedInventory);
  } catch (error) {
    res.status(400).json({ message: 'Error updating inventory', error });
  }
};

export const deleteInventory = async (req: any, res: Response) => {
  try {
    const deletedInventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!deletedInventory) return res.status(404).json({ message: 'Inventory not found' });

    await ActivityLog.create({
      type: 'delete',
      message: `${deletedInventory.name} removed from inventory`,
      user: req.user?.name || 'System',
    });

    res.json({ message: 'Inventory deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting inventory', error });
  }
};
