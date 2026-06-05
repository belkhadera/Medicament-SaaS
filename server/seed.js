import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Inventory from './src/models/Inventory.js';
import User from './src/models/User.js';
import Supplier from './src/models/Supplier.js';

dotenv.config();

const suppliers = [
  { name: 'MedSupply Co.', contact: 'contact@medsupply.com', phone: '+1 (555) 123-4567', status: 'active', orders: 45, rating: 4.8 },
  { name: 'PharmaDirect', contact: 'sales@pharmadirect.com', phone: '+1 (555) 234-5678', status: 'active', orders: 38, rating: 4.6 },
  { name: 'HealthCare Supplies', contact: 'info@healthcaresup.com', phone: '+1 (555) 345-6789', status: 'active', orders: 52, rating: 4.9 },
  { name: 'MediSource Plus', contact: 'orders@medisource.com', phone: '+1 (555) 456-7890', status: 'pending', orders: 12, rating: 4.3 },
];

const users = [
  {
    name: 'Dr. Sarah Johnson',
    email: 'sarah.j@hospital.com',
    password: 'password123',
    role: 'Administrator',
    status: 'active'
  },
  {
    name: 'John Miller',
    email: 'john.m@hospital.com',
    password: 'password123',
    role: 'Pharmacist',
    status: 'active'
  }
];

const inventoryData = [
  { name: 'Amoxicillin 500mg', category: 'Antibiotic', batch: 'BT-2024-001', stock: 450, minStock: 200, expiry: new Date('2025-03-15'), status: 'optimal', location: 'A-12' },
  { name: 'Ibuprofen 400mg', category: 'Pain Relief', batch: 'BT-2024-002', stock: 85, minStock: 100, expiry: new Date('2024-12-20'), status: 'low', location: 'B-05' },
  { name: 'Metformin 850mg', category: 'Diabetes', batch: 'BT-2024-003', stock: 320, minStock: 150, expiry: new Date('2024-11-10'), status: 'expiring', location: 'C-18' },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare-saas');
    console.log('Connected to MongoDB for seeding...');
    
    await Inventory.deleteMany({});
    await Inventory.insertMany(inventoryData);

    await User.deleteMany({});
     for (const user of users) {
       await User.create(user);
     }

     await Supplier.deleteMany({});
     await Supplier.insertMany(suppliers);
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
