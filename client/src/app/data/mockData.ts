export const inventoryData = [
  { id: 1, name: 'Amoxicillin 500mg', category: 'Antibiotic', batch: 'BT-2024-001', stock: 450, minStock: 200, expiry: '2025-03-15', status: 'optimal', location: 'A-12' },
  { id: 2, name: 'Ibuprofen 400mg', category: 'Pain Relief', batch: 'BT-2024-002', stock: 85, minStock: 100, expiry: '2024-12-20', status: 'low', location: 'B-05' },
  { id: 3, name: 'Metformin 850mg', category: 'Diabetes', batch: 'BT-2024-003', stock: 320, minStock: 150, expiry: '2024-11-10', status: 'expiring', location: 'C-18' },
  { id: 4, name: 'Lisinopril 10mg', category: 'Cardiovascular', batch: 'BT-2024-004', stock: 0, minStock: 100, expiry: '2025-06-30', status: 'out', location: 'A-22' },
  { id: 5, name: 'Atorvastatin 20mg', category: 'Cardiovascular', batch: 'BT-2024-005', stock: 560, minStock: 200, expiry: '2025-08-15', status: 'optimal', location: 'D-09' },
  { id: 6, name: 'Omeprazole 20mg', category: 'Gastrointestinal', batch: 'BT-2024-006', stock: 180, minStock: 150, expiry: '2024-10-25', status: 'expired', location: 'B-14' },
  { id: 7, name: 'Amlodipine 5mg', category: 'Cardiovascular', batch: 'BT-2024-007', stock: 420, minStock: 200, expiry: '2025-04-12', status: 'optimal', location: 'C-07' },
  { id: 8, name: 'Levothyroxine 100mcg', category: 'Endocrine', batch: 'BT-2024-008', stock: 95, minStock: 100, expiry: '2025-01-18', status: 'low', location: 'A-31' },
];

export const chartData = [
  { month: 'Jan', dispensed: 4200, received: 5100, waste: 120 },
  { month: 'Feb', dispensed: 3800, received: 4500, waste: 95 },
  { month: 'Mar', dispensed: 5100, received: 5800, waste: 140 },
  { month: 'Apr', dispensed: 4600, received: 5200, waste: 110 },
  { month: 'May', dispensed: 5400, received: 6100, waste: 160 },
  { month: 'Jun', dispensed: 6200, received: 6800, waste: 145 },
];

export const categoryDistribution = [
  { name: 'Cardiovascular', value: 1340, color: '#2563EB' },
  { name: 'Antibiotics', value: 890, color: '#06B6D4' },
  { name: 'Pain Relief', value: 650, color: '#10B981' },
  { name: 'Diabetes', value: 540, color: '#F59E0B' },
  { name: 'Other', value: 780, color: '#8B5CF6' },
];

export const recentActivity = [
  { type: 'scan', message: 'Amoxicillin 500mg scanned and added', time: '5 min ago', user: 'Dr. Sarah Johnson' },
  { type: 'alert', message: 'Low stock alert for Ibuprofen 400mg', time: '12 min ago', user: 'System' },
  { type: 'expiry', message: '3 medications expiring in 30 days', time: '1 hour ago', user: 'System' },
  { type: 'order', message: 'New order placed with MedSupply Co.', time: '2 hours ago', user: 'John Miller' },
  { type: 'transfer', message: 'Transferred 50 units to Storage B', time: '3 hours ago', user: 'Emma Davis' },
];

export const suppliers = [
  { id: 1, name: 'MedSupply Co.', contact: 'contact@medsupply.com', phone: '+1 (555) 123-4567', status: 'active', orders: 45, rating: 4.8 },
  { id: 2, name: 'PharmaDirect', contact: 'sales@pharmadirect.com', phone: '+1 (555) 234-5678', status: 'active', orders: 38, rating: 4.6 },
  { id: 3, name: 'HealthCare Supplies', contact: 'info@healthcaresup.com', phone: '+1 (555) 345-6789', status: 'active', orders: 52, rating: 4.9 },
  { id: 4, name: 'MediSource Plus', contact: 'orders@medisource.com', phone: '+1 (555) 456-7890', status: 'pending', orders: 12, rating: 4.3 },
];

export const users = [
  { id: 1, name: 'Dr. Sarah Johnson', email: 'sarah.j@hospital.com', role: 'Administrator', status: 'active', lastActive: '2 min ago' },
  { id: 2, name: 'John Miller', email: 'john.m@hospital.com', role: 'Pharmacist', status: 'active', lastActive: '15 min ago' },
  { id: 3, name: 'Emma Davis', email: 'emma.d@hospital.com', role: 'Inventory Manager', status: 'active', lastActive: '1 hour ago' },
  { id: 4, name: 'Michael Chen', email: 'michael.c@hospital.com', role: 'Pharmacy Tech', status: 'active', lastActive: '3 hours ago' },
  { id: 5, name: 'Lisa Anderson', email: 'lisa.a@hospital.com', role: 'Viewer', status: 'inactive', lastActive: '2 days ago' },
];
