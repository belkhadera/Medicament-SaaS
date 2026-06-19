import { useEffect, useMemo, useState } from "react";
import { Plus, Tags, Edit, Trash2, Loader2, Barcode, PackagePlus, ShoppingCart, MapPin } from "lucide-react";
import { medicationService, Medication } from "../../services/medication.service";
import { inventoryService, InventoryItem } from "../../services/inventory.service";
import { formatCurrency, formatNumber, daysUntil } from "../lib/inventoryStats";
import { Modal } from "../components/common/Modal";
import { StatusBadges } from "../components/common/StatusBadges";
import { BatchFormModal } from "../components/inventory/BatchFormModal";
import { OrderFormModal } from "../components/inventory/OrderFormModal";
import { MedicineConnectionsModal } from "../components/inventory/MedicineConnectionsModal";
import {
  MEDICINE_CATEGORIES,
  CONDITION_META,
  conditionForCategory,
  StorageCondition,
} from "../../services/medicineReference";

interface MedStock {
  stock: number;
  lots: number;
  locations: number;
  /** All statuses that apply at once (expiry + stock axes), e.g. expiring + low. */
  statuses: string[];
}

/**
 * Aggregate live stock per medication id. Stock status (out/low) reflects the
 * TOTAL on hand vs the reorder point (not a single low shelf); expiry status
 * (expired/expiring) reflects the worst lot. Both can apply at once.
 */
function aggregateStock(items: InventoryItem[]): Map<string, MedStock> {
  const groups = new Map<string, InventoryItem[]>();
  for (const it of items) {
    if (!it.medicationId) continue;
    // Only lots that actually hold stock occupy a location. Empty lots are
    // deleted on depletion; any leftover (legacy) empties must not inflate the
    // "lots / empl." count, which would disagree with the locations pop-up.
    if (it.stock <= 0) continue;
    const list = groups.get(it.medicationId) ?? [];
    list.push(it);
    groups.set(it.medicationId, list);
  }
  const map = new Map<string, MedStock>();
  for (const [id, group] of groups) {
    let stock = 0;
    let threshold = 0;
    let anyExpired = false;
    let anyExpiring = false;
    const locs = new Set<string>();
    for (const it of group) {
      stock += it.stock;
      locs.add(it.location);
      threshold = Math.max(threshold, it.minStock || 0);
      const d = daysUntil(it.expiry);
      if (d < 0) anyExpired = true;
      else if (d <= 90) anyExpiring = true;
    }
    const statuses: string[] = [];
    if (anyExpired) statuses.push("expired");
    else if (anyExpiring) statuses.push("expiring");
    if (stock <= 0) statuses.push("out");
    else if (stock < threshold) statuses.push("low");
    if (!statuses.length) statuses.push("optimal");
    map.set(id, { stock, lots: group.length, locations: locs.size, statuses });
  }
  return map;
}

interface MedicationsScreenProps {
  searchQuery: string;
}

interface FormState {
  name: string;
  category: string;
  barcode: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  defaultMinStock: string;
  salePrice: string;
  purchasePrice: string;
  storageCondition: StorageCondition;
}

const emptyForm: FormState = {
  name: "", category: "", barcode: "", dosageForm: "", strength: "", manufacturer: "",
  defaultMinStock: "", salePrice: "", purchasePrice: "", storageCondition: "ambient",
};

function toForm(m: Medication): FormState {
  return {
    name: m.name,
    category: m.category,
    barcode: m.barcode ?? "",
    dosageForm: m.dosageForm ?? "",
    strength: m.strength ?? "",
    manufacturer: m.manufacturer ?? "",
    defaultMinStock: String(m.defaultMinStock ?? 10),
    salePrice: String(m.salePrice ?? ""),
    purchasePrice: m.purchasePrice ? String(m.purchasePrice) : "",
    storageCondition: m.storageCondition ?? conditionForCategory(m.category),
  };
}

export function MedicationsScreen({ searchQuery }: MedicationsScreenProps) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Connected "add a batch" form, locked to a medication.
  const [batchForMed, setBatchForMed] = useState<string | null>(null);

  // Quick "commander" (purchase order) flow, pre-filled with one medication.
  const [orderMed, setOrderMed] = useState<Medication | null>(null);

  // "Where is this stocked?" — opens the per-location breakdown for a medicine.
  const [locationsMedId, setLocationsMedId] = useState<string | null>(null);

  const fetchMeds = async () => {
    try {
      const res = await medicationService.getAll();
      setMeds(res.data);
    } catch {
      setError("Échec du chargement du catalogue. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await inventoryService.getAll();
      setInventory(res.data);
    } catch {
      /* live stock is supplementary; the catalog still renders without it */
    }
  };

  useEffect(() => {
    fetchMeds();
    fetchInventory();
  }, []);

  const stockByMed = useMemo(() => aggregateStock(inventory), [inventory]);

  // Every batch (across all units/shelves) of the medicine whose locations are open.
  const locationItems = useMemo(
    () => (locationsMedId ? inventory.filter((i) => i.medicationId === locationsMedId) : []),
    [inventory, locationsMedId],
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (m: Medication) => {
    setEditing(m);
    setForm(toForm(m));
    setFormError(null);
    setModalOpen(true);
  };

  const setField = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Picking a category auto-derives the storage condition it requires (still
  // overridable via the condition selector below).
  const setCategory = (category: string) =>
    setForm((p) => ({ ...p, category, storageCondition: conditionForCategory(category) }));

  const handleSubmit = async () => {
    if (!form.name || !form.category) {
      setFormError("Le nom et la catégorie sont obligatoires.");
      return;
    }
    const salePrice = Number(form.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      setFormError("Le prix de vente doit être un nombre strictement positif.");
      return;
    }
    // Buy price is optional, but if entered it must be a non-negative number.
    const purchasePrice = form.purchasePrice.trim() === "" ? 0 : Number(form.purchasePrice);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setFormError("Le prix d'achat doit être un nombre positif ou nul.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload: Partial<Medication> = {
      name: form.name.trim(),
      category: form.category.trim(),
      barcode: form.barcode.trim() || undefined,
      dosageForm: form.dosageForm.trim() || undefined,
      strength: form.strength.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      defaultMinStock: form.defaultMinStock ? Number(form.defaultMinStock) : 10,
      salePrice,
      purchasePrice,
      storageCondition: form.storageCondition,
    };
    try {
      if (editing) {
        await medicationService.update(editing._id, payload);
      } else {
        await medicationService.create(payload);
      }
      await fetchMeds();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Échec de l'enregistrement. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (m: Medication) => {
    if (!window.confirm(`Désactiver « ${m.name} » ? Il sera masqué du catalogue mais son historique est conservé.`)) return;
    setDeletingId(m._id);
    try {
      await medicationService.delete(m._id);
      await fetchMeds();
    } catch {
      alert("Échec de la désactivation du médicament.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = meds.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.barcode ?? "").includes(searchQuery),
  );

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Chargement du catalogue...</div>;
  }
  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Catalogue des médicaments</h2>
          <p className="text-muted-foreground mt-1">
            {meds.length} produits — la liste maîtresse référencée par les lots et les commandes
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Ajouter un médicament</span>
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                {["Médicament", "Catégorie", "Code-barres", "Stock total", "Lots / Empl.", "Prix de vente", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => (
                <tr key={m._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Tags className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{m.category}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                    {m.barcode ? (
                      <span className="flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" />{m.barcode}</span>
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const agg = stockByMed.get(m._id);
                      if (!agg) return <span className="text-sm text-muted-foreground/50">—</span>;
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{formatNumber(agg.stock)}</span>
                          <StatusBadges statuses={agg.statuses} />
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {(() => {
                      const agg = stockByMed.get(m._id);
                      if (!agg) return "—";
                      return (
                        <button
                          onClick={() => setLocationsMedId(m._id)}
                          className="flex items-center gap-1.5 text-secondary hover:underline"
                          title="Voir tous les emplacements de ce médicament"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          {agg.lots} lot(s) · {agg.locations} empl.
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{formatCurrency(m.salePrice ?? 0)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setOrderMed(m)} className="p-1.5 hover:bg-accent rounded" title="Commander ce médicament">
                        <ShoppingCart className="w-4 h-4 text-primary" />
                      </button>
                      <button onClick={() => setBatchForMed(m._id)} className="p-1.5 hover:bg-accent rounded" title="Ajouter un lot">
                        <PackagePlus className="w-4 h-4 text-success" />
                      </button>
                      <button onClick={() => openEdit(m)} className="p-1.5 hover:bg-accent rounded" title="Modifier">
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDeactivate(m)} disabled={deletingId === m._id} className="p-1.5 hover:bg-accent rounded" title="Désactiver">
                        {deletingId === m._id
                          ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                          : <Trash2 className="w-4 h-4 text-destructive" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun médicament dans le catalogue.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MedicineConnectionsModal
        open={locationsMedId !== null}
        onClose={() => setLocationsMedId(null)}
        items={locationItems}
      />

      <BatchFormModal
        open={batchForMed !== null}
        onClose={() => setBatchForMed(null)}
        onSaved={fetchInventory}
        lockMedicationId={batchForMed ?? undefined}
      />

      <OrderFormModal
        open={orderMed !== null}
        onClose={() => setOrderMed(null)}
        medication={orderMed}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Modifier le médicament" : "Ajouter un médicament"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Enregistrer" : "Ajouter"}
            </button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{formError}</div>}
        <div className="space-y-3">
          <Input label="Nom du médicament *" value={form.name} onChange={(v) => setField("name", v)} placeholder="ex. Amoxicilline 500mg" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catégorie *</label>
              <select
                value={MEDICINE_CATEGORIES.some((c) => c.name === form.category) ? form.category : (form.category ? "__legacy" : "")}
                onChange={(e) => e.target.value !== "__legacy" && setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
              >
                <option value="">— Sélectionner —</option>
                {form.category && !MEDICINE_CATEGORIES.some((c) => c.name === form.category) && (
                  <option value="__legacy">{form.category} (actuelle)</option>
                )}
                {MEDICINE_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input label="Code-barres" value={form.barcode} onChange={(v) => setField("barcode", v)} placeholder="facultatif" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Forme galénique" value={form.dosageForm} onChange={(v) => setField("dosageForm", v)} placeholder="ex. Comprimé" />
            <Input label="Dosage" value={form.strength} onChange={(v) => setField("strength", v)} placeholder="ex. 500mg" />
            <Input label="Fabricant" value={form.manufacturer} onChange={(v) => setField("manufacturer", v)} placeholder="ex. Sanofi" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Condition de conservation</label>
            <select
              value={form.storageCondition}
              onChange={(e) => setField("storageCondition", e.target.value)}
              className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
            >
              {(Object.keys(CONDITION_META) as StorageCondition[]).map((c) => (
                <option key={c} value={c}>{CONDITION_META[c].label} ({CONDITION_META[c].tempRange})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Pré-remplie d'après la catégorie. À stocker en unité <strong>{CONDITION_META[form.storageCondition].short}</strong>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prix de vente (DH) *" type="number" value={form.salePrice} onChange={(v) => setField("salePrice", v)} placeholder="0.00" />
            <Input label="Prix d'achat de référence (DH)" type="number" value={form.purchasePrice} onChange={(v) => setField("purchasePrice", v)} placeholder="0.00" />
          </div>
          <Input label="Stock min par défaut" type="number" value={form.defaultMinStock} onChange={(v) => setField("defaultMinStock", v)} placeholder="10" />
          <p className="text-xs text-muted-foreground">
            Le prix d'achat de référence pré-remplit le coût lors d'une commande. Il se met à jour automatiquement avec le coût du dernier lot réceptionné ; le coût réel par lot reste saisi à la réception.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
      />
    </div>
  );
}
