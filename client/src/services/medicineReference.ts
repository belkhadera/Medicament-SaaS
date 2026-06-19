/**
 * Client mirror of the server's medicine reference (lib/medicineReference.ts):
 * the canonical category list and the storage condition each category requires.
 * Keep in sync with the server copy.
 */
export type StorageCondition = 'cold' | 'ambient' | 'controlled';

export type StorageType = 'cold' | 'ambient' | 'controlled' | 'quarantine' | 'general';

export interface ConditionMeta {
  label: string;
  short: string;
  tempRange: string;
  storageTypes: StorageType[];
}

export const CONDITION_META: Record<StorageCondition, ConditionMeta> = {
  cold: {
    label: 'Réfrigéré (chaîne du froid)',
    short: 'Réfrigéré 2–8 °C',
    tempRange: '2 à 8 °C',
    storageTypes: ['cold'],
  },
  ambient: {
    label: 'Température ambiante contrôlée',
    short: 'Ambiant 15–25 °C',
    tempRange: '15 à 25 °C',
    storageTypes: ['ambient', 'general'],
  },
  controlled: {
    label: 'Substance contrôlée (armoire sécurisée)',
    short: 'Sécurisé / verrouillé',
    tempRange: '15 à 25 °C, accès restreint',
    storageTypes: ['controlled'],
  },
};

export interface CategoryDef {
  name: string;
  condition: StorageCondition;
  forms?: string;
}

export const MEDICINE_CATEGORIES: CategoryDef[] = [
  { name: 'Vaccins', condition: 'cold', forms: 'Injectable' },
  { name: 'Insulines', condition: 'cold', forms: 'Injectable, Stylo' },
  { name: 'Produits biologiques', condition: 'cold', forms: 'Injectable' },
  { name: 'Sérums et immunoglobulines', condition: 'cold', forms: 'Injectable' },
  { name: 'Stupéfiants (opioïdes)', condition: 'controlled', forms: 'Comprimé, Injectable, Patch' },
  { name: 'Psychotropes', condition: 'controlled', forms: 'Comprimé' },
  { name: 'Anxiolytiques / Benzodiazépines', condition: 'controlled', forms: 'Comprimé' },
  { name: 'Antibiotiques', condition: 'ambient', forms: 'Comprimé, Gélule, Sirop' },
  { name: 'Antiviraux', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Antifongiques', condition: 'ambient', forms: 'Comprimé, Crème' },
  { name: 'Antiparasitaires', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Analgésiques / Antalgiques', condition: 'ambient', forms: 'Comprimé, Sirop' },
  { name: 'Anti-inflammatoires (AINS)', condition: 'ambient', forms: 'Comprimé, Gel' },
  { name: 'Antipyrétiques', condition: 'ambient', forms: 'Comprimé, Sirop, Suppositoire' },
  { name: 'Cardiovasculaires / Antihypertenseurs', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Hypolipémiants (statines)', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Antidiabétiques oraux', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Antihistaminiques', condition: 'ambient', forms: 'Comprimé, Sirop' },
  { name: 'Gastro-intestinaux', condition: 'ambient', forms: 'Comprimé, Suspension' },
  { name: 'Antiémétiques', condition: 'ambient', forms: 'Comprimé, Injectable' },
  { name: 'Respiratoires', condition: 'ambient', forms: 'Inhalateur, Sirop' },
  { name: 'Neurologiques / Antiépileptiques', condition: 'ambient', forms: 'Comprimé, Gélule' },
  { name: 'Corticoïdes', condition: 'ambient', forms: 'Comprimé, Injectable' },
  { name: 'Dermatologiques', condition: 'ambient', forms: 'Crème, Pommade' },
  { name: 'Ophtalmiques (collyres)', condition: 'ambient', forms: 'Collyre' },
  { name: 'Hormones (hors insuline)', condition: 'ambient', forms: 'Comprimé' },
  { name: 'Vitamines et compléments', condition: 'ambient', forms: 'Comprimé, Sirop' },
  { name: 'Solutions et perfusions', condition: 'ambient', forms: 'Solution, Perfusion' },
  { name: 'Matériel médical et diagnostic', condition: 'ambient', forms: 'Bandelettes, Dispositif' },
  { name: 'Autres', condition: 'ambient' },
];

const CONTROLLED_KEYWORDS = [
  'stupéfiant', 'stupefiant', 'psychotrop', 'opio', 'opiac', 'narcot', 'morphin',
  'fentanyl', 'méthadone', 'methadone', 'benzodiaz', 'anxiolytiq', 'codéine', 'codeine',
  'tramadol', 'oxycodone',
];
const COLD_KEYWORDS = [
  'vaccin', 'insulin', 'biolog', 'sérum', 'serum', 'immunoglobulin', 'interféron',
  'interferon', 'érythropo', 'erythropo', 'epo', 'anticorps', 'monoclonal', 'sanguin',
  'hormone de croissance',
];

const norm = (s: string) => (s || '').toLowerCase().trim();

/** The storage condition a category requires (keyword fallback for free text). */
export function conditionForCategory(category: string): StorageCondition {
  const c = norm(category);
  if (!c) return 'ambient';
  const exact = MEDICINE_CATEGORIES.find((d) => norm(d.name) === c);
  if (exact) return exact.condition;
  if (CONTROLLED_KEYWORDS.some((k) => c.includes(k))) return 'controlled';
  if (COLD_KEYWORDS.some((k) => c.includes(k))) return 'cold';
  return 'ambient';
}

/** True when a storage-unit type is suitable for a medicine needing `condition`. */
export function storageSuitsCondition(condition: StorageCondition, storageType?: StorageType): boolean {
  if (!storageType) return false;
  return CONDITION_META[condition].storageTypes.includes(storageType);
}
