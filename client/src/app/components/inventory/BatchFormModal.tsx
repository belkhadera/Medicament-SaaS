import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight, PackagePlus } from "lucide-react";
import { Modal } from "../common/Modal";
import { inventoryService } from "../../../services/inventory.service";
import { medicationService, Medication } from "../../../services/medication.service";
import { storageService, StorageWithContents } from "../../../services/storage.service";
import {
  CONDITION_META,
  conditionForCategory,
  storageSuitsCondition,
  StorageCondition,
} from "../../../services/medicineReference";

interface BatchFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-fix the medication (e.g. opened from the Catalogue row). */
  lockMedicationId?: string;
  /** Pre-fix the destination unit (e.g. opened from a Storage shelf). */
  lockStorageId?: string;
  /** Pre-fix the destination shelf. */
  lockShelf?: string;
}

interface FormState {
  medicationId: string;
  storageId: string;
  shelf: string;
  batch: string;
  stock: string;
  minStock: string;
  purchasePrice: string;
  expiry: string;
}

const emptyForm: FormState = {
  medicationId: "", storageId: "", shelf: "", batch: "", stock: "", minStock: "", purchasePrice: "", expiry: "",
};

const inputCls = "w-full px-4 py-2 bg-input-background border border-border rounded-lg disabled:opacity-60";

/**
 * The single, connected "add a batch" experience reused across screens. It ties
 * a physical batch to an existing catalog medication AND an existing storage
 * unit/shelf — strictly, via pickers — so every stock operation is referentially
 * correct. New medications/units are created on their own screens.
 */
export function BatchFormModal({ open, onClose, onSaved, lockMedicationId, lockStorageId, lockShelf }: BatchFormModalProps) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [units, setUnits] = useState<StorageWithContents[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load catalog + storage units each time the modal opens, then seed locks.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([medicationService.getAll(), storageService.getAll()])
      .then(([m, s]) => {
        if (!active) return;
        setMeds(m.data);
        setUnits(s.data.units);
        // When the medicine is pre-locked, seed its buy price / min stock now that
        // the catalogue is loaded (the synchronous reset below can't see it yet).
        if (lockMedicationId) {
          const med = m.data.find((x) => x._id === lockMedicationId);
          if (med) {
            setForm((p) => ({
              ...p,
              purchasePrice: p.purchasePrice || (med.purchasePrice ? String(med.purchasePrice) : ""),
              minStock: p.minStock || (med.defaultMinStock != null ? String(med.defaultMinStock) : ""),
            }));
          }
        }
      })
      .catch(() => active && setError("Échec du chargement du catalogue et des unités de stockage."))
      .finally(() => active && setLoading(false));
    setForm({ ...emptyForm, medicationId: lockMedicationId ?? "", storageId: lockStorageId ?? "", shelf: lockShelf ?? "" });
    return () => { active = false; };
  }, [open, lockMedicationId, lockStorageId, lockShelf]);

  const setField = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const selectedMed = useMemo(() => meds.find((m) => m._id === form.medicationId), [meds, form.medicationId]);
  const selectedUnit = useMemo(() => units.find((u) => u._id === form.storageId), [units, form.storageId]);
  const shelfOptions = useMemo(
    () => (selectedUnit ? selectedUnit.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : []),
    [selectedUnit],
  );

  // Picking a medication seeds its default min stock AND its reference buy price
  // (the per-lot cost defaults to the catalogue buy price; still overridable if
  // this delivery's cost differs).
  const onPickMed = (id: string) => {
    const med = meds.find((m) => m._id === id);
    setForm((p) => ({
      ...p,
      medicationId: id,
      minStock: p.minStock || (med?.defaultMinStock != null ? String(med.defaultMinStock) : ""),
      purchasePrice: med?.purchasePrice ? String(med.purchasePrice) : "",
    }));
  };

  // Storage condition this medicine requires, and whether the chosen unit suits it.
  const requiredCondition: StorageCondition | null = selectedMed
    ? (selectedMed.storageCondition ?? conditionForCategory(selectedMed.category))
    : null;
  const storageMismatch =
    !!requiredCondition && !!selectedUnit && !storageSuitsCondition(requiredCondition, selectedUnit.type);

  // Warn (don't block) when the sale price would be below this lot's cost.
  const purchasePriceNum = Number(form.purchasePrice);
  const marginWarning =
    !!selectedMed &&
    Number.isFinite(purchasePriceNum) &&
    purchasePriceNum > 0 &&
    selectedMed.salePrice < purchasePriceNum;

  const destination = selectedMed && selectedUnit
    ? `${selectedMed.name} → ${selectedUnit.name}${form.shelf ? ` / ${form.shelf}` : ""}`
    : null;

  const handleSubmit = async () => {
    if (!form.medicationId || !form.storageId || !form.batch || !form.stock || !form.expiry) {
      setError("Sélectionnez un médicament, une destination, et renseignez le lot, la quantité et la péremption.");
      return;
    }
    if (!Number.isFinite(purchasePriceNum) || purchasePriceNum <= 0) {
      setError("Le prix d'achat doit être un nombre strictement positif.");
      return;
    }
    if (shelfOptions.length > 0 && !form.shelf) {
      setError("Choisissez une étagère pour cette unité.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await inventoryService.create({
        medicationId: form.medicationId,
        storageId: form.storageId,
        shelf: form.shelf || undefined,
        batch: form.batch.trim(),
        stock: Number(form.stock),
        minStock: form.minStock ? Number(form.minStock) : undefined,
        purchasePrice: purchasePriceNum,
        expiry: form.expiry,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Échec de l'enregistrement du lot. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const noMeds = !loading && meds.length === 0;
  const noUnits = !loading && units.length === 0;
  const blocked = noMeds || noUnits;

  return (
    <Modal
      open={open}
      title="Ajouter un lot à l'inventaire"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={saving || loading || blocked}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            Ajouter
          </button>
        </>
      }
    >
      {loading ? (
        <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : blocked ? (
        <div className="p-4 bg-warning/10 border border-warning/20 text-foreground text-sm rounded-lg space-y-1">
          {noMeds && <p>Aucun médicament dans le catalogue. Créez-en un d'abord dans <strong>Catalogue</strong>.</p>}
          {noUnits && <p>Aucune unité de stockage. Créez-en une d'abord dans <strong>Stockage</strong>.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{error}</div>}

          {/* Medication picker */}
          <Field label="Médicament *">
            <select value={form.medicationId} onChange={(e) => onPickMed(e.target.value)} disabled={!!lockMedicationId} className={inputCls}>
              <option value="">— Sélectionner —</option>
              {meds.map((m) => (
                <option key={m._id} value={m._id}>{m.name} · {m.category}</option>
              ))}
            </select>
          </Field>
          {selectedMed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-1 flex-wrap">
              <span>Catégorie : {selectedMed.category}</span>
              {selectedMed.barcode && <span className="font-mono">· {selectedMed.barcode}</span>}
              {requiredCondition && (
                <span className="px-2 py-0.5 rounded-full font-medium bg-secondary/10 text-secondary">
                  Conservation : {CONDITION_META[requiredCondition].short}
                </span>
              )}
            </div>
          )}

          {/* Destination */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unité de stockage *">
              <select value={form.storageId} onChange={(e) => setForm((p) => ({ ...p, storageId: e.target.value, shelf: "" }))} disabled={!!lockStorageId} className={inputCls}>
                <option value="">— Sélectionner —</option>
                {units.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Étagère">
              <select value={form.shelf} onChange={(e) => setField("shelf", e.target.value)} disabled={!form.storageId || !!lockShelf} className={inputCls}>
                <option value="">{shelfOptions.length ? "— Sélectionner —" : "— Aucune —"}</option>
                {shelfOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Batch fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Numéro de lot *">
              <input value={form.batch} onChange={(e) => setField("batch", e.target.value)} placeholder="BT-2024-001" className={inputCls} />
            </Field>
            <Field label="Quantité *">
              <input type="number" min={0} value={form.stock} onChange={(e) => setField("stock", e.target.value)} placeholder="0" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Stock min">
              <input type="number" min={0} value={form.minStock} onChange={(e) => setField("minStock", e.target.value)} placeholder="10" className={inputCls} />
            </Field>
            <Field label="Prix d'achat (DH) *">
              <input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => setField("purchasePrice", e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Péremption *">
              <input type="date" value={form.expiry} onChange={(e) => setField("expiry", e.target.value)} className={inputCls} />
            </Field>
          </div>

          {selectedMed && (
            <p className="text-xs text-muted-foreground -mt-1">
              Prix de vente du médicament : <span className="font-medium text-foreground">{selectedMed.salePrice} DH</span>
            </p>
          )}
          {marginWarning && (
            <div className="p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg">
              Attention : le prix de vente ({selectedMed!.salePrice} DH) est inférieur au prix d'achat de ce lot ({purchasePriceNum} DH) — marge négative.
            </div>
          )}
          {storageMismatch && (
            <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
              Attention : « {selectedMed!.name} » doit être conservé en <strong>{CONDITION_META[requiredCondition!].label}</strong> ({CONDITION_META[requiredCondition!].tempRange}), mais l'unité « {selectedUnit!.name} » est de type « {selectedUnit!.type} ». Choisissez une unité adaptée.
            </div>
          )}

          {destination && (
            <div className="flex items-center gap-2 p-3 bg-secondary/10 text-secondary rounded-lg text-sm font-medium">
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>{destination}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
