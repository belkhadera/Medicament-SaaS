import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../common/Modal";
import { Medication } from "../../../services/medication.service";
import { supplierService, Supplier } from "../../../services/supplier.service";
import { purchaseOrderService } from "../../../services/purchaseOrder.service";
import { formatCurrency } from "../../lib/inventoryStats";

interface OrderFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a draft order is created (e.g. to refresh a list). */
  onSaved?: () => void;
  /** The medication this order is for — pre-fills and locks the line. */
  medication: Medication | null;
}

const inputCls = "w-full px-4 py-2 bg-input-background border border-border rounded-lg disabled:opacity-60";

/**
 * Quick "commander ce médicament" flow: creates a single-line draft purchase
 * order for one medication, reusing the same endpoint as the Achats screen. The
 * medication is fixed; the user only picks a supplier, quantity and unit cost.
 */
export function OrderFormModal({ open, onClose, onSaved, medication }: OrderFormModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load suppliers and seed sensible defaults each time the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    setQuantity(medication?.defaultMinStock ? String(medication.defaultMinStock) : "1");
    // Pre-fill the unit cost from the medication's reference buy price (the last
    // known cost). Left blank when unknown (0/absent) so the user must enter one.
    setUnitPrice(medication?.purchasePrice ? String(medication.purchasePrice) : "");
    supplierService
      .getAll()
      .then((res) => {
        if (!active) return;
        const active1 = res.data.filter((s) => s.status === "active");
        const list = active1.length ? active1 : res.data;
        setSuppliers(list);
        setSupplierId(list[0]?._id ?? "");
      })
      .catch(() => active && setError("Échec du chargement des fournisseurs."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, medication]);

  const total = useMemo(
    () => (Number(quantity) || 0) * (Number(unitPrice) || 0),
    [quantity, unitPrice],
  );

  const handleSubmit = async () => {
    if (!medication) return;
    if (!supplierId) {
      setError("Choisissez un fournisseur.");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("La quantité doit être supérieure à 0.");
      return;
    }
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Le prix unitaire doit être un nombre positif.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await purchaseOrderService.create({
        supplierId,
        lines: [{ medicationId: medication._id, quantity: qty, unitPrice: price }],
      });
      toast.success(`Commande créée pour ${medication.name}`, {
        description: `${data.reference} · ${qty} unité(s) — brouillon à soumettre dans Achats.`,
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de créer la commande.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Commander ce médicament"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Créer la commande
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{error}</div>
      )}

      {medication && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
          <span className="font-medium text-foreground">{medication.name}</span>
          <span className="text-sm text-muted-foreground">{medication.category}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : suppliers.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground text-center">
          Aucun fournisseur disponible. Ajoutez-en un dans l'écran Fournisseurs avant de commander.
        </p>
      ) : (
        <div className="space-y-3">
          <Field label="Fournisseur *">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité *">
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Prix unitaire (DH) *">
              <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground mr-2">Total :</span>
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            La commande est créée en brouillon. Soumettez-la et réceptionnez-la depuis l'écran Achats.
          </p>
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
