/**
 * Idempotent translation of catalog content to French.
 * Updates Medication categories + name spellings. Re-running is a no-op once
 * everything is French. The backup `inventories` collection is left untouched.
 *
 *   node --import tsx scripts/translateData.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Medication from '../src/models/Medication';
dotenv.config();

const CATEGORIES: Record<string, string> = {
  'Antibiotic': 'Antibiotique',
  'Antihistamine': 'Antihistaminique',
  'Cardiovascular': 'Cardiovasculaire',
  'Diabetes': 'Diabète',
  'diabetes': 'Diabète',
  'Endocrine': 'Endocrinien',
  'Gastrointestinal': 'Gastro-intestinal',
  'Neurological': 'Neurologique',
  'Pain Relief': 'Antalgique',
  'Respiratory': 'Respiratoire',
};

const NAMES: Record<string, string> = {
  'Amoxicillin 500mg': 'Amoxicilline 500mg',
  'Azithromycin 250mg': 'Azithromycine 250mg',
  'Ciprofloxacin 500mg': 'Ciprofloxacine 500mg',
  'Ibuprofen 400mg': 'Ibuprofène 400mg',
  'Paracetamol 500mg': 'Paracétamol 500mg',
  'Naproxen 250mg': 'Naproxène 250mg',
  'Metformin 850mg': 'Metformine 850mg',
  'Insulin Glargine': 'Insuline glargine',
  'Atorvastatin 20mg': 'Atorvastatine 20mg',
  'Omeprazole 20mg': 'Oméprazole 20mg',
  'Ondansetron 4mg': 'Ondansétron 4mg',
  'Levothyroxine 100mcg': 'Lévothyroxine 100mcg',
  'Salbutamol Inhaler': 'Salbutamol (inhalateur)',
  'Montelukast 10mg': 'Montélukast 10mg',
  'Cetirizine 10mg': 'Cétirizine 10mg',
  'Diazepam 5mg': 'Diazépam 5mg',
  'Gabapentin 300mg': 'Gabapentine 300mg',
  'accu-check': 'Accu-Chek',
};

await mongoose.connect(process.env.MONGODB_URI!);
let catUpdates = 0, nameUpdates = 0;

for (const [en, fr] of Object.entries(CATEGORIES)) {
  const r = await Medication.updateMany({ category: en }, { $set: { category: fr } });
  catUpdates += r.modifiedCount;
}
for (const [en, fr] of Object.entries(NAMES)) {
  const r = await Medication.updateOne({ name: en }, { $set: { name: fr } });
  nameUpdates += r.modifiedCount;
}

console.log(`categories updated: ${catUpdates}`);
console.log(`names updated: ${nameUpdates}`);
console.log('remaining categories:', JSON.stringify(await Medication.distinct('category')));
await mongoose.disconnect();