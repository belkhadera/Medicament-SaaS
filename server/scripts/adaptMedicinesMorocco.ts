/**
 * Adapt the whole medication catalog to the data model AND the Moroccan market.
 *
 * For each medicine (matched by active ingredient, accent-insensitive) this sets
 * every catalog field coherently:
 *   - category        → a canonical category from lib/medicineReference
 *   - dosageForm      → galenic form (Comprimé, Gélule, Injectable…)
 *   - strength        → dose
 *   - manufacturer    → a laboratory present on the Moroccan market
 *   - defaultMinStock → a sensible reorder point
 *   - salePrice (PPV) → regulated public sale price, MAD (medicament.ma, 2026)
 *   - purchasePrice (PPH) → pharmacy wholesale cost, MAD (catalog reference)
 *   - storageCondition→ derived from the category (cold / ambient / controlled)
 * It also aligns each active lot's purchasePrice to the PPH.
 *
 * Prices/labs reflect the Moroccan market. Preview by default; pass --apply to
 * write. Idempotent. Unmatched catalog rows are reported, never touched.
 *
 *   node --import tsx scripts/adaptMedicinesMorocco.ts            # preview
 *   node --import tsx scripts/adaptMedicinesMorocco.ts --apply    # write
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Medication from '../src/models/Medication';
import InventoryBatch from '../src/models/InventoryBatch';
import { conditionForCategory } from '../src/lib/medicineReference';

dotenv.config();

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface MedSpec {
  match: string[];        // lowercase accent-free substrings — ALL must be in the name
  label: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;   // lab present on the Moroccan market
  minStock: number;
  ppv: number;            // salePrice (MAD, TTC)
  pph: number;            // purchasePrice (MAD, wholesale)
}

const SPECS: MedSpec[] = [
  { match: ['amox'],                label: 'Amoxicilline 500mg',    category: 'Antibiotiques',                       dosageForm: 'Gélule',                    strength: '500 mg',      manufacturer: 'Sothema',       minStock: 30, ppv: 32,  pph: 23 },
  { match: ['azithro'],             label: 'Azithromycine 250mg',   category: 'Antibiotiques',                       dosageForm: 'Comprimé',                  strength: '250 mg',      manufacturer: 'Maphar',        minStock: 20, ppv: 62,  pph: 45 },
  { match: ['ciproflox'],           label: 'Ciprofloxacine 500mg',  category: 'Antibiotiques',                       dosageForm: 'Comprimé',                  strength: '500 mg',      manufacturer: 'Cooper Pharma', minStock: 20, ppv: 95,  pph: 70 },
  { match: ['ibuprof'],             label: 'Ibuprofène 400mg',      category: 'Anti-inflammatoires (AINS)',          dosageForm: 'Comprimé',                  strength: '400 mg',      manufacturer: 'Sothema',       minStock: 40, ppv: 22,  pph: 15 },
  { match: ['paracetamol'],         label: 'Paracétamol 500mg',     category: 'Analgésiques / Antalgiques',          dosageForm: 'Comprimé',                  strength: '500 mg',      manufacturer: 'Laprophan',     minStock: 50, ppv: 10,  pph: 7 },
  { match: ['naprox'],              label: 'Naproxène 250mg',       category: 'Anti-inflammatoires (AINS)',          dosageForm: 'Comprimé',                  strength: '250 mg',      manufacturer: 'Pharma 5',      minStock: 30, ppv: 35,  pph: 25 },
  { match: ['metform'],             label: 'Metformine 850mg',      category: 'Antidiabétiques oraux',               dosageForm: 'Comprimé',                  strength: '850 mg',      manufacturer: 'Sothema',       minStock: 40, ppv: 19,  pph: 13 },
  { match: ['insulin', 'glargine'], label: 'Insuline glargine',     category: 'Insulines',                           dosageForm: 'Solution injectable (stylo)', strength: '100 UI/ml',  manufacturer: 'Sanofi',        minStock: 15, ppv: 744, pph: 630 },
  { match: ['atorvastat'],          label: 'Atorvastatine 20mg',    category: 'Hypolipémiants (statines)',           dosageForm: 'Comprimé',                  strength: '20 mg',       manufacturer: 'Cooper Pharma', minStock: 30, ppv: 90,  pph: 72 },
  { match: ['omeprazol'],           label: 'Oméprazole 20mg',       category: 'Gastro-intestinaux',                  dosageForm: 'Gélule',                    strength: '20 mg',       manufacturer: 'Cooper Pharma', minStock: 30, ppv: 40,  pph: 28 },
  { match: ['ondansetron'],         label: 'Ondansétron 4mg',       category: 'Antiémétiques',                       dosageForm: 'Comprimé',                  strength: '4 mg',        manufacturer: 'Maphar',        minStock: 15, ppv: 280, pph: 230 },
  { match: ['levothyrox'],          label: 'Lévothyroxine 100mcg',  category: 'Hormones (hors insuline)',            dosageForm: 'Comprimé',                  strength: '100 µg',      manufacturer: 'Merck',         minStock: 25, ppv: 23,  pph: 16 },
  { match: ['salbutamol'],          label: 'Salbutamol inhalateur', category: 'Respiratoires',                       dosageForm: 'Inhalateur',                strength: '100 µg/dose', manufacturer: 'Cooper Pharma', minStock: 20, ppv: 37,  pph: 27 },
  { match: ['montelukast'],         label: 'Montélukast 10mg',      category: 'Respiratoires',                       dosageForm: 'Comprimé',                  strength: '10 mg',       manufacturer: 'Pharma 5',      minStock: 15, ppv: 307, pph: 250 },
  { match: ['cetirizin'],           label: 'Cétirizine 10mg',       category: 'Antihistaminiques',                   dosageForm: 'Comprimé',                  strength: '10 mg',       manufacturer: 'Sothema',       minStock: 30, ppv: 59,  pph: 43 },
  { match: ['diazep'],              label: 'Diazépam 5mg',          category: 'Anxiolytiques / Benzodiazépines',     dosageForm: 'Comprimé',                  strength: '5 mg',        manufacturer: 'Laprophan',     minStock: 20, ppv: 12,  pph: 8 },
  { match: ['gabapentin'],          label: 'Gabapentine 300mg',     category: 'Neurologiques / Antiépileptiques',    dosageForm: 'Gélule',                    strength: '300 mg',      manufacturer: 'Pharma 5',      minStock: 20, ppv: 287, pph: 235 },
  { match: ['accu'],                label: 'Accu-Chek bandelettes', category: 'Matériel médical et diagnostic',      dosageForm: 'Bandelettes',               strength: '50 bandelettes', manufacturer: 'Roche',      minStock: 15, ppv: 205, pph: 150 },
  { match: ['tramadol'],            label: 'Tramadol 50mg',         category: 'Stupéfiants (opioïdes)',              dosageForm: 'Gélule',                    strength: '50 mg',       manufacturer: 'Cooper Pharma', minStock: 20, ppv: 26,  pph: 19 },
  { match: ['gliclazid'],           label: 'Gliclazide 80mg',       category: 'Antidiabétiques oraux',               dosageForm: 'Comprimé',                  strength: '80 mg',       manufacturer: 'Sothema',       minStock: 30, ppv: 37,  pph: 27 },
  { match: ['amlodipin'],           label: 'Amlodipine 5mg',        category: 'Cardiovasculaires / Antihypertenseurs', dosageForm: 'Comprimé',                strength: '5 mg',        manufacturer: 'Pharma 5',      minStock: 40, ppv: 48,  pph: 35 },
  { match: ['bisoprolol'],          label: 'Bisoprolol 5mg',        category: 'Cardiovasculaires / Antihypertenseurs', dosageForm: 'Comprimé',                strength: '5 mg',        manufacturer: 'Cooper Pharma', minStock: 40, ppv: 55,  pph: 40 },
  { match: ['clopidogrel'],         label: 'Clopidogrel 75mg',      category: 'Cardiovasculaires / Antihypertenseurs', dosageForm: 'Comprimé',                strength: '75 mg',       manufacturer: 'Sothema',       minStock: 25, ppv: 160, pph: 125 },
  { match: ['pantoprazol'],         label: 'Pantoprazole 40mg',     category: 'Gastro-intestinaux',                  dosageForm: 'Comprimé gastro-résistant', strength: '40 mg',       manufacturer: 'Maphar',        minStock: 30, ppv: 60,  pph: 44 },
  { match: ['prednisolon'],         label: 'Prednisolone 5mg',      category: 'Corticoïdes',                         dosageForm: 'Comprimé',                  strength: '5 mg',        manufacturer: 'Laprophan',     minStock: 25, ppv: 24,  pph: 17 },
  { match: ['loratadin'],           label: 'Loratadine 10mg',       category: 'Antihistaminiques',                   dosageForm: 'Comprimé',                  strength: '10 mg',       manufacturer: 'Bottu',         minStock: 30, ppv: 35,  pph: 26 },
];

function specFor(name: string): MedSpec | undefined {
  const n = norm(name);
  return SPECS.find((s) => s.match.every((m) => n.includes(m)));
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const apply = process.argv.includes('--apply');

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}  (${apply ? 'APPLY' : 'PREVIEW'})\n`);

  const meds = await Medication.find({});
  let medsUpdated = 0;
  let batchesUpdated = 0;
  const unmatched: string[] = [];

  for (const med of meds) {
    const spec = specFor(med.name);
    if (!spec) { unmatched.push(med.name); continue; }

    const condition = conditionForCategory(spec.category);
    console.log(
      `${med.name}\n` +
      `    → ${spec.category} · ${spec.dosageForm} ${spec.strength} · ${spec.manufacturer}\n` +
      `    → PPV ${spec.ppv} / PPH ${spec.pph} MAD · min ${spec.minStock} · ${condition}`,
    );

    if (apply) {
      med.category = spec.category;
      med.dosageForm = spec.dosageForm;
      med.strength = spec.strength;
      med.manufacturer = spec.manufacturer;
      med.defaultMinStock = spec.minStock;
      med.salePrice = spec.ppv;
      med.purchasePrice = spec.pph;
      med.storageCondition = condition;
      await med.save();
      medsUpdated++;

      const batches = await InventoryBatch.find({ medicationId: med._id, status: 'active' });
      for (const b of batches) {
        let changed = false;
        if (b.purchasePrice !== spec.pph) { b.purchasePrice = spec.pph; changed = true; }
        if (b.minStock !== spec.minStock) { b.minStock = spec.minStock; changed = true; }
        if (changed) { await b.save(); batchesUpdated++; }
      }
    }
  }

  console.log('\n--- summary ---');
  console.log(`  catalog rows matched:  ${meds.length - unmatched.length} / ${meds.length}`);
  if (apply) {
    console.log(`  medications updated:   ${medsUpdated}`);
    console.log(`  active lots updated:   ${batchesUpdated}`);
  } else {
    console.log('  (preview only — re-run with --apply to write)');
  }
  if (unmatched.length) {
    console.log(`  UNMATCHED (left untouched): ${JSON.stringify(unmatched)}`);
    console.log('  → add a SPECS entry for each and re-run.');
  }

  await mongoose.disconnect();
}

run().catch((err) => { console.error('Adaptation failed:', err); process.exit(1); });
