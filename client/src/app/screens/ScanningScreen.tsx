import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { toast } from "sonner";
import {
  ScanLine,
  Camera,
  CheckCircle,
  XCircle,
  Loader2,
  RotateCcw,
  Pill,
  PackagePlus,
  PackageMinus,
  Sparkles,
  ClipboardCheck,
  ArrowLeft,
} from "lucide-react";
import { inventoryService, type InventoryItem } from "../../services/inventory.service";
import { medicationService, type Medication } from "../../services/medication.service";
import { storageService, type StorageWithContents } from "../../services/storage.service";
import {
  purchaseOrderService,
  type PurchaseOrder,
  type DeliverItem,
} from "../../services/purchaseOrder.service";
import { Modal } from "../components/common/Modal";
import { notifyInventoryChanged } from "../lib/inventoryEvents";
import { MEDICINE_CATEGORIES, CONDITION_META, conditionForCategory } from "../../services/medicineReference";

// A scanned code that starts with this prefix is an order id (delivery flow),
// not a medication barcode.
const ORDER_PREFIX = /^ORD-/i;

interface DeliverRow {
  receivedQuantity: string;
  lotNumber: string;
  expiry: string;
  purchasePrice: string;
  storageId: string;
  shelf: string;
}

const medOf = (m: any) => (typeof m === "object" && m ? m : { _id: m, name: String(m) });

// "Add new medication" form shown when a scanned barcode is unknown. Required
// fields mirror the server validation; barcode is fixed from the scan.
interface NewMedForm {
  barcode: string;
  name: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  salePrice: string;
  purchasePrice: string;
  minStock: string;
  lotNumber: string;
  quantity: string;
  expiry: string;
  supplier: string;
}

const emptyNewMed: NewMedForm = {
  barcode: "", name: "", category: "", dosageForm: "", strength: "", manufacturer: "",
  salePrice: "", purchasePrice: "", minStock: "", lotNumber: "", quantity: "", expiry: "", supplier: "",
};

/** Client-side validation mirroring the server. Returns an error string or null. */
function validateNewMed(f: NewMedForm): string | null {
  if (!f.name.trim()) return "Le nom est obligatoire.";
  if (!f.category.trim()) return "La catégorie est obligatoire.";
  if (!f.dosageForm.trim()) return "La forme galénique est obligatoire.";
  if (!f.strength.trim()) return "Le dosage est obligatoire.";
  if (!f.manufacturer.trim()) return "Le fabricant est obligatoire.";
  const salePrice = Number(f.salePrice);
  if (!Number.isFinite(salePrice) || salePrice <= 0) return "Le prix de vente doit être un nombre strictement positif.";
  const purchasePrice = Number(f.purchasePrice);
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return "Le prix d'achat doit être un nombre strictement positif.";
  const min = Number(f.minStock);
  if (!Number.isInteger(min) || min < 0) return "Le seuil de stock minimum doit être un entier positif ou nul.";
  if (!f.lotNumber.trim()) return "Le numéro de lot est obligatoire.";
  const qty = Number(f.quantity);
  if (!Number.isInteger(qty) || qty <= 0) return "La quantité initiale doit être un entier strictement positif.";
  if (!f.expiry) return "La date de péremption est obligatoire.";
  const exp = new Date(f.expiry);
  if (isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return "La date de péremption doit être dans le futur.";
  return null;
}

interface BatchForm {
  batch: string;
  quantity: string;
  minStock: string;
  purchasePrice: string;
  expiry: string;
  storageId: string;
  shelf: string;
}

const emptyForm: BatchForm = {
  batch: "", quantity: "", minStock: "", purchasePrice: "", expiry: "", storageId: "", shelf: "",
};

type ScanMode = "in" | "out";
type SaveState = "idle" | "saving" | "success" | "error";
type LookupState = "idle" | "looking" | "found" | "new";
type OutReason = "dispense" | "expired" | "damaged";

const inputCls = "w-full px-4 py-2 bg-input-background border border-border rounded-lg disabled:opacity-60";

export function ScanningScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [mode, setMode] = useState<ScanMode>("in");
  const modeRef = useRef<ScanMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [units, setUnits] = useState<StorageWithContents[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>("idle");

  // "in" mode — receive a new batch into storage.
  const [medication, setMedication] = useState<Medication | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  // Current batches of the resolved medication (shown when a barcode is known).
  const [medBatches, setMedBatches] = useState<InventoryItem[]>([]);

  // "Add new medication" flow (unknown barcode in "in" mode).
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [newMed, setNewMed] = useState<NewMedForm>(emptyNewMed);
  const [fdaLoading, setFdaLoading] = useState(false);
  const [newMedSaving, setNewMedSaving] = useState(false);
  const [newMedError, setNewMedError] = useState<string | null>(null);

  // Order-delivery flow (an ORD- code was scanned). Supersedes the medication
  // in/out flow until the user goes back.
  const [orderFlow, setOrderFlow] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [orderState, setOrderState] = useState<"looking" | "found" | "notfound" | "delivered" | "cancelled">("looking");
  const [deliverRows, setDeliverRows] = useState<Record<string, DeliverRow>>({});
  const [deliverSaving, setDeliverSaving] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);

  // "out" mode — withdraw/dispense across a medication's linked lots (FEFO).
  const [outItem, setOutItem] = useState<InventoryItem | null>(null);
  // All in-stock lots of the resolved medication, sorted earliest-expiry first.
  const [outBatches, setOutBatches] = useState<InventoryItem[]>([]);
  const [outQty, setOutQty] = useState("");
  const [outReason, setOutReason] = useState<OutReason>("dispense");
  const [outNote, setOutNote] = useState("");

  // Stop the camera stream whenever we leave the screen.
  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  // Storage units feed the destination pickers (in mode).
  useEffect(() => {
    storageService.getAll().then((res) => setUnits(res.data.units)).catch(() => {});
  }, []);

  const shelfOptions = useMemo(() => {
    const u = units.find((x) => x._id === form.storageId);
    return u ? u.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
  }, [units, form.storageId]);

  // Total on-hand across the medication's lots — what FEFO can withdraw.
  const outTotal = useMemo(() => outBatches.reduce((s, b) => s + b.stock, 0), [outBatches]);
  const outHasStock = outTotal > 0;

  const stopScan = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  const startScan = async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      // Prefer the rear ("environment") camera on phones; `ideal` falls back to
      // the only available camera on laptops instead of erroring.
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (result, _error, controls) => {
          if (result) {
            const text = result.getText();
            setBarcode(text);
            controls.stop();
            controlsRef.current = null;
            setScanning(false);
            void lookupBarcode(text);
          }
          // No result this frame is normal — keep scanning.
        },
      );
      controlsRef.current = controls;
    } catch (err) {
      console.error("Camera/scan error:", err);
      setCameraError(
        "Impossible d'accéder à la caméra. Autorisez l'accès à la caméra et assurez-vous qu'aucune autre application ne l'utilise.",
      );
      setScanning(false);
    }
  };

  const updateField = (field: keyof BatchForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (saveState !== "idle") setSaveState("idle");
  };

  // Resolve a barcode. In "in" mode it identifies the catalog medication to
  // receive; in "out" mode it finds the stock batch in storage to subtract from.
  const lookupBarcode = async (code: string, modeOverride?: ScanMode) => {
    const m = modeOverride ?? modeRef.current;
    const trimmed = code.trim();
    if (!trimmed) {
      setLookupState("idle");
      setMedication(null);
      setOutItem(null);
      return;
    }
    // One scanner, two flows: an ORD- code is an order delivery, not a medication.
    // Order delivery is a receiving (stock-in) operation only — never in "out" mode.
    if (ORDER_PREFIX.test(trimmed)) {
      if (m !== "in") {
        toast.error("Code de commande détecté", {
          description: "Les livraisons se réceptionnent en mode Entrée. Basculez sur « Entrée (réception) ».",
        });
        setLookupState("idle");
        return;
      }
      void lookupOrder(trimmed);
      return;
    }
    setLookupState("looking");
    setSaveState("idle");
    setSaveError(null);
    try {
      if (m === "in") {
        const { data } = await medicationService.getByBarcode(trimmed);
        setMedication(data);
        setForm((prev) => ({
          ...prev,
          minStock: data.defaultMinStock != null ? String(data.defaultMinStock) : "",
          // Default the per-lot cost to the medicine's reference buy price (overridable).
          purchasePrice: data.purchasePrice ? String(data.purchasePrice) : "",
        }));
        setLookupState("found");
        void fetchMedBatches(data._id);
      } else {
        const { data } = await inventoryService.getByBarcode(trimmed);
        setOutItem(data);
        // Load every in-stock lot of this medication (FEFO order) to dispense across.
        const total = await loadOutBatches(data.medicationId);
        setLookupState(total > 0 ? "found" : "new");
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setMedication(null);
        setOutItem(null);
        setOutBatches([]);
        setMedBatches([]);
        setLookupState("new");
        // Unknown barcode while receiving → open the "add new medication" flow
        // (FDA pre-fill is best-effort and never blocks).
        if (m === "in") void beginAddMedication(trimmed);
      } else {
        console.error("Barcode lookup failed:", err);
        setMedication(null);
        setOutItem(null);
        setOutBatches([]);
        setLookupState("idle");
      }
    }
  };

  /**
   * Load every in-stock lot of a medication, sorted earliest-expiry first (FEFO),
   * and return the total available. Drives the "out" withdrawal flow.
   */
  const loadOutBatches = async (medicationId?: string): Promise<number> => {
    if (!medicationId) { setOutBatches([]); return 0; }
    try {
      const { data } = await inventoryService.getAll();
      const batches = data
        .filter((r) => String(r.medicationId) === String(medicationId) && r.stock > 0)
        .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
      setOutBatches(batches);
      return batches.reduce((s, b) => s + b.stock, 0);
    } catch {
      setOutBatches([]);
      return 0;
    }
  };

  /** Load the resolved medication's existing batches (lot / qty / expiry list). */
  const fetchMedBatches = async (medicationId: string) => {
    try {
      const { data } = await inventoryService.getAll();
      setMedBatches(data.filter((r) => String(r.medicationId) === String(medicationId)));
    } catch {
      setMedBatches([]); // the list is supplementary context
    }
  };

  /** Open the add-medication modal for an unknown barcode, pre-filling via FDA. */
  const beginAddMedication = async (code: string) => {
    setNewMed({ ...emptyNewMed, barcode: code });
    setNewMedError(null);
    setAddMedOpen(true);
    setFdaLoading(true);
    try {
      const { data } = await medicationService.fdaLookup(code);
      // Only fill empty fields, so anything the user already typed wins.
      setNewMed((prev) => ({
        ...prev,
        name: prev.name || data.name || "",
        dosageForm: prev.dosageForm || data.dosageForm || "",
        strength: prev.strength || data.strength || "",
        manufacturer: prev.manufacturer || data.manufacturer || "",
      }));
    } catch {
      /* FDA lookup is best-effort — never block adding the medication */
    } finally {
      setFdaLoading(false);
    }
  };

  const setNewMedField = (field: keyof NewMedForm, value: string) => {
    setNewMed((prev) => ({ ...prev, [field]: value }));
    if (newMedError) setNewMedError(null);
  };

  // Warn (don't block) when the new medication's sale price is below its cost.
  const newMedMarginWarning =
    Number(newMed.salePrice) > 0 &&
    Number(newMed.purchasePrice) > 0 &&
    Number(newMed.salePrice) < Number(newMed.purchasePrice);

  const submitNewMed = async () => {
    const validationError = validateNewMed(newMed);
    if (validationError) {
      setNewMedError(validationError);
      return;
    }
    setNewMedSaving(true);
    setNewMedError(null);
    try {
      const { data } = await medicationService.createWithBatch({
        barcode: newMed.barcode || undefined,
        name: newMed.name.trim(),
        category: newMed.category.trim(),
        dosageForm: newMed.dosageForm.trim(),
        strength: newMed.strength.trim(),
        manufacturer: newMed.manufacturer.trim(),
        salePrice: Number(newMed.salePrice),
        purchasePrice: Number(newMed.purchasePrice),
        minStock: Number(newMed.minStock),
        lotNumber: newMed.lotNumber.trim(),
        quantity: Number(newMed.quantity),
        expiry: newMed.expiry,
        supplier: newMed.supplier.trim() || undefined,
        storageId: form.storageId || undefined,
        shelf: form.shelf || undefined,
      });
      toast.success(`${data.medication.name} ajouté à l'inventaire`, {
        description: `Lot ${newMed.lotNumber.trim()} · ${data.totalStock} unité(s) en stock.`,
      });
      // Return to the scanner ready for the next item.
      setAddMedOpen(false);
      setNewMed(emptyNewMed);
      setBarcode("");
      setMedication(null);
      setMedBatches([]);
      setLookupState("idle");
    } catch (err: any) {
      const serverErrors = err.response?.data?.errors;
      setNewMedError(
        Array.isArray(serverErrors) ? serverErrors.join(" ") :
          err.response?.data?.message || "Échec de la création du médicament. Veuillez réessayer.",
      );
    } finally {
      setNewMedSaving(false);
    }
  };

  // --- order delivery flow (ORD- codes) ---
  const exitOrderFlow = () => {
    setOrderFlow(false);
    setOrder(null);
    setDeliverRows({});
    setDeliverError(null);
    setBarcode("");
    setLookupState("idle");
  };

  const lookupOrder = async (code: string) => {
    setOrderFlow(true);
    setOrder(null);
    setDeliverError(null);
    setDeliverRows({});
    setOrderState("looking");
    setLookupState("idle");
    try {
      const { data } = await purchaseOrderService.getByOrderId(code);
      setOrder(data);
      if (data.status === "received") {
        setOrderState("delivered");
      } else if (data.status === "cancelled") {
        setOrderState("cancelled");
      } else {
        // Pending: pre-fill each remaining line for confirmation.
        const rows: Record<string, DeliverRow> = {};
        for (const l of data.lines) {
          const id = medOf(l.medicationId)._id;
          const remaining = l.quantity - l.receivedQuantity;
          // Pre-fill the per-batch purchase price from the last known cost (server
          // falls back to the order line's unit price), editable by the user.
          const prefillCost = l.lastPurchasePrice ?? l.unitPrice ?? 0;
          if (remaining > 0) {
            rows[id] = {
              receivedQuantity: String(remaining),
              lotNumber: "",
              expiry: "",
              purchasePrice: prefillCost ? String(prefillCost) : "",
              storageId: "",
              shelf: "",
            };
          }
        }
        setDeliverRows(rows);
        setOrderState("found");
      }
    } catch (err: any) {
      setOrderState("notfound");
      if (err.response?.status !== 404) {
        setDeliverError(err.response?.data?.message || "Erreur lors du chargement de la commande.");
      }
    }
  };

  const setDeliverField = (mid: string, patch: Partial<DeliverRow>) =>
    setDeliverRows((prev) => ({ ...prev, [mid]: { ...prev[mid], ...patch } }));

  const confirmDelivery = async () => {
    if (!order) return;
    const entries = Object.entries(deliverRows);
    if (entries.length === 0) { setDeliverError("Aucun article à livrer."); return; }
    // Client validation mirrors the server.
    const items: DeliverItem[] = [];
    for (const [mid, row] of entries) {
      const qty = Number(row.receivedQuantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        setDeliverError("Les quantités reçues doivent être des entiers strictement positifs.");
        return;
      }
      if (!row.lotNumber.trim()) {
        setDeliverError("Chaque article doit avoir un numéro de lot.");
        return;
      }
      const exp = new Date(row.expiry);
      if (!row.expiry || isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
        setDeliverError("Chaque article doit avoir une date de péremption future.");
        return;
      }
      const purchasePrice = Number(row.purchasePrice);
      if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
        setDeliverError("Chaque article doit avoir un prix d'achat strictement positif.");
        return;
      }
      // If a storage unit with shelves is chosen, a shelf must be picked too.
      const unit = units.find((u) => u._id === row.storageId);
      const rowShelfOptions = unit ? unit.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
      if (row.storageId && rowShelfOptions.length > 0 && !row.shelf) {
        setDeliverError("Choisissez une étagère pour l'unité de stockage sélectionnée.");
        return;
      }
      items.push({
        medicationId: mid,
        receivedQuantity: qty,
        lotNumber: row.lotNumber.trim(),
        expiry: row.expiry,
        purchasePrice,
        storageId: row.storageId || undefined,
        shelf: row.storageId ? row.shelf || undefined : undefined,
      });
    }
    setDeliverSaving(true);
    setDeliverError(null);
    try {
      const { data } = await purchaseOrderService.deliver(order.orderId, items);
      const totalUnits = data.summary.reduce((s, r) => s + r.quantity, 0);
      toast.success(`Livraison confirmée — ${order.reference}`, {
        description: `${data.summary.length} lot(s) · ${totalUnits} unité(s) ajoutée(s) au stock.`,
      });
      exitOrderFlow();
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Already delivered/cancelled — reflect that instead of erroring out.
        if (err.response.data?.order) setOrder(err.response.data.order);
        setOrderState("delivered");
      } else {
        const serverErrors = err.response?.data?.errors;
        setDeliverError(
          Array.isArray(serverErrors) ? serverErrors.join(" ") :
            err.response?.data?.message || "Échec de la confirmation de livraison.",
        );
      }
    } finally {
      setDeliverSaving(false);
    }
  };

  const switchMode = (m: ScanMode) => {
    if (m === mode) return;
    setMode(m);
    setSaveState("idle");
    setSaveError(null);
    setMedication(null);
    setMedBatches([]);
    setOutItem(null);
    setOutBatches([]);
    setOutQty("");
    setOutNote("");
    setLookupState(barcode.trim() ? "looking" : "idle");
    if (barcode.trim()) void lookupBarcode(barcode, m);
  };

  const resetAll = () => {
    stopScan();
    setBarcode("");
    setForm(emptyForm);
    setMedication(null);
    setMedBatches([]);
    setOutItem(null);
    setOutBatches([]);
    setOutQty("");
    setOutNote("");
    setOutReason("dispense");
    setSaveState("idle");
    setSaveError(null);
    setCameraError(null);
    setLookupState("idle");
    setAddMedOpen(false);
    setNewMed(emptyNewMed);
    setNewMedError(null);
    setOrderFlow(false);
    setOrder(null);
    setDeliverRows({});
    setDeliverError(null);
  };

  const requiredMissing =
    !medication || !form.batch || !form.quantity || !form.purchasePrice || !form.expiry || !form.storageId ||
    (shelfOptions.length > 0 && !form.shelf);

  // Warn (don't block) when the medication's sale price is below this lot's cost.
  const receivePurchaseNum = Number(form.purchasePrice);
  const receiveMarginWarning =
    !!medication &&
    Number.isFinite(receivePurchaseNum) &&
    receivePurchaseNum > 0 &&
    medication.salePrice < receivePurchaseNum;

  const handleReceive = async () => {
    if (!medication) {
      setSaveError("Sélectionnez un médicament connu (scannez un code-barres enregistré).");
      setSaveState("error");
      return;
    }
    if (requiredMissing) {
      setSaveError("Veuillez remplir tous les champs obligatoires (*).");
      setSaveState("error");
      return;
    }
    if (!Number.isFinite(receivePurchaseNum) || receivePurchaseNum <= 0) {
      setSaveError("Le prix d'achat doit être un nombre strictement positif.");
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await inventoryService.create({
        medicationId: medication._id,
        storageId: form.storageId,
        shelf: form.shelf || undefined,
        batch: form.batch.trim(),
        stock: Number(form.quantity),
        minStock: form.minStock ? Number(form.minStock) : undefined,
        purchasePrice: receivePurchaseNum,
        expiry: form.expiry,
      });
      setSaveState("success");
      notifyInventoryChanged();
      toast.success(`Lot ajouté à ${medication.name}`, {
        description: `Lot ${form.batch.trim()} · ${form.quantity} unité(s).`,
      });
      setForm(emptyForm);
      setBarcode("");
      setMedication(null);
      setMedBatches([]);
      setLookupState("idle");
    } catch (err: any) {
      console.error("Failed to save inventory item:", err);
      setSaveError(
        err.response?.data?.message || err.response?.data?.error ||
          "Échec de l'enregistrement en inventaire. Veuillez réessayer.",
      );
      setSaveState("error");
    }
  };

  const handleRemove = async () => {
    if (!outItem || !outItem.medicationId) {
      setSaveError("Aucun médicament identifié pour ce code-barres.");
      setSaveState("error");
      return;
    }
    const qty = Number(outQty);
    if (!qty || qty <= 0) {
      setSaveError("Saisissez une quantité supérieure à 0.");
      setSaveState("error");
      return;
    }
    if (qty > outTotal) {
      setSaveError(`Seulement ${outTotal} en stock pour ce médicament.`);
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      // FEFO: the server consumes the earliest-expiry lots first, across lots.
      const { data } = await inventoryService.dispense({
        medicationId: outItem.medicationId,
        quantity: qty,
        reason: outReason,
        note: outNote.trim() || undefined,
      });
      setSaveState("success");
      notifyInventoryChanged();
      toast.success(`Retiré : ${data.dispensed} unité(s) de ${data.medication}`, {
        description: `${data.movements.length} lot(s) utilisé(s) · reste ${data.remainingTotal} en stock.`,
      });
      // Refresh the remaining lots so the displayed total reflects the withdrawal.
      const total = await loadOutBatches(outItem.medicationId);
      setOutQty("");
      setOutNote("");
      if (total <= 0) setLookupState("new");
    } catch (err: any) {
      console.error("Failed to remove stock:", err);
      setSaveError(
        err.response?.data?.message || err.response?.data?.error ||
          "Échec du retrait de stock. Veuillez réessayer.",
      );
      setSaveState("error");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Scanner un médicament
          </h2>
          <p className="text-muted-foreground mt-1">
            Scannez un code-barres pour {mode === "in" ? "ajouter du stock à l'inventaire" : "retirer du stock de l'inventaire"}
          </p>
        </div>
        <button
          onClick={resetAll}
          className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Réinitialiser
        </button>
      </div>

      {!orderFlow && (
        <>
      {/* Mode toggle — receive into vs. remove from inventory */}
      <div className="grid grid-cols-2 gap-2 max-w-md">
        <button
          onClick={() => switchMode("in")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            mode === "in" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          <PackagePlus className="w-4 h-4" /> Entrée (réception)
        </button>
        <button
          onClick={() => switchMode("out")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            mode === "out" ? "border-warning bg-warning/10 text-warning" : "border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          <PackageMinus className="w-4 h-4" /> Sortie (retrait)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner panel */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Scanner</h3>

          <div
            className={`relative aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed ${
              scanning ? "border-primary" : "border-border"
            }`}
          >
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${scanning ? "block" : "hidden"}`}
              muted
              playsInline
            />
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-1/2 border-2 border-primary/80 rounded-lg" />
              </div>
            )}
            {!scanning && (
              <div className="text-center p-8">
                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-2">
                  Caméra éteinte
                </p>
                <p className="text-xs text-muted-foreground">
                  Démarrez le scanner et placez le code-barres dans le cadre
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{cameraError}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!scanning ? (
              <button
                onClick={startScan}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <ScanLine className="w-5 h-5" />
                Démarrer le scan
              </button>
            ) : (
              <button
                onClick={stopScan}
                className="w-full border border-border py-3 rounded-lg font-medium hover:bg-accent flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Arrêter le scan
              </button>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs text-muted-foreground mb-1 block">
              Code-barres scanné
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                if (lookupState !== "idle") setLookupState("idle");
              }}
              onBlur={(e) => lookupBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookupBarcode(barcode);
              }}
              placeholder="Scannez un code ou saisissez-le manuellement"
              className="w-full px-4 py-2 bg-input-background border border-border rounded-lg font-mono"
            />
            {lookupState === "looking" && (
              <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Recherche du code-barres…
              </p>
            )}
            {lookupState === "found" && (
              <p className="mt-2 text-xs text-success flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {mode === "in"
                  ? "Médicament reconnu — choisissez l'emplacement et saisissez les détails du lot."
                  : "Stock trouvé — saisissez la quantité à retirer."}
              </p>
            )}
            {lookupState === "new" && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-warning flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  {mode === "in"
                    ? "Code-barres inconnu — renseignez le formulaire pour l'ajouter à l'inventaire."
                    : outItem
                      ? "Aucun stock disponible pour ce médicament."
                      : "Code-barres inconnu — aucun stock à retirer."}
                </p>
                {mode === "in" && barcode.trim() && (
                  <button
                    onClick={() => beginAddMedication(barcode.trim())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <PackagePlus className="w-3.5 h-3.5" /> Ajouter ce médicament
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action panel */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {mode === "in" ? "Détails du lot" : "Retrait du stock"}
          </h3>

          {saveState === "success" && (
            <div className="mb-4 bg-success/10 border border-success/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {mode === "in" ? "Ajouté à l'inventaire" : "Retiré de l'inventaire"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === "in"
                    ? "Le lot a été enregistré dans la base de données. Scannez l'article suivant."
                    : "Le stock a été décrémenté dans la base de données. Scannez l'article suivant."}
                </p>
              </div>
            </div>
          )}

          {saveState === "error" && saveError && (
            <div className="mb-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{saveError}</p>
            </div>
          )}

          {mode === "in" ? (
            <>
              {/* Resolved medication (read-only — driven by the barcode) */}
              <div className="mb-4 flex items-center gap-3 p-3 rounded-lg border border-border bg-muted">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-primary" />
                </div>
                {medication ? (
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{medication.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[medication.category, medication.strength, medication.dosageForm].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Scannez un code-barres pour identifier le médicament.</p>
                )}
              </div>

              {/* Current batches for the resolved medication — add a new one below. */}
              {medication && medBatches.length > 0 && (
                <div className="mb-4 rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted text-xs font-semibold text-foreground">
                    Lots existants ({medBatches.length})
                  </div>
                  <ul className="divide-y divide-border max-h-40 overflow-y-auto">
                    {medBatches.map((b) => (
                      <li key={b._id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-foreground truncate">{b.batch || "—"}</span>
                        <span className="text-muted-foreground shrink-0">
                          {b.stock} u · exp. {b.expiry ? new Date(b.expiry).toLocaleDateString("fr-FR") : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Unité de stockage" required>
                    <select
                      value={form.storageId}
                      onChange={(e) => setForm((p) => ({ ...p, storageId: e.target.value, shelf: "" }))}
                      className={inputCls}
                      disabled={units.length === 0}
                    >
                      <option value="">{units.length ? "— Sélectionner —" : "Aucune unité — créez-en une"}</option>
                      {units.map((u) => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Étagère">
                    <select
                      value={form.shelf}
                      onChange={(e) => updateField("shelf", e.target.value)}
                      disabled={!form.storageId}
                      className={inputCls}
                    >
                      <option value="">{shelfOptions.length ? "— Sélectionner —" : "— Aucune —"}</option>
                      {shelfOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Numéro de lot" required>
                    <input type="text" value={form.batch} onChange={(e) => updateField("batch", e.target.value)} placeholder="BT-2024-001" className={inputCls} />
                  </Field>
                  <Field label="Quantité" required>
                    <input type="number" min={0} value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} placeholder="0" className={inputCls} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Stock min">
                    <input type="number" min={0} value={form.minStock} onChange={(e) => updateField("minStock", e.target.value)} placeholder="10" className={inputCls} />
                  </Field>
                  <Field label="Prix d'achat (DH)" required>
                    <input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => updateField("purchasePrice", e.target.value)} placeholder="0.00" className={inputCls} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date de péremption" required>
                    <input type="date" value={form.expiry} onChange={(e) => updateField("expiry", e.target.value)} className={inputCls} />
                  </Field>
                </div>

                {medication && (
                  <p className="text-xs text-muted-foreground">
                    Prix de vente : <span className="font-medium text-foreground">{medication.salePrice} DH</span>
                  </p>
                )}
                {receiveMarginWarning && (
                  <div className="p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg">
                    Attention : le prix de vente ({medication!.salePrice} DH) est inférieur au prix d'achat de ce lot ({receivePurchaseNum} DH) — marge négative.
                  </div>
                )}
              </div>

              <button
                onClick={handleReceive}
                disabled={saveState === "saving" || !medication}
                className="mt-6 w-full bg-success text-white py-3 rounded-lg font-medium hover:bg-success/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveState === "saving"
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</>
                  : <><PackagePlus className="w-5 h-5" /> Ajouter à l'inventaire</>}
              </button>
            </>
          ) : (
            <>
              {/* Resolved medication — withdrawal spans its lots, FEFO (read-only) */}
              <div className="mb-4 flex items-center gap-3 p-3 rounded-lg border border-border bg-muted">
                <div className="w-9 h-9 bg-warning/10 rounded-lg flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-warning" />
                </div>
                {outItem && outHasStock ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{outItem.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {outBatches.length} lot(s) · sortie au plus tôt périmé d'abord (FEFO)
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {outItem ? `Aucun stock disponible pour ${outItem.name}.` : "Scannez un code-barres pour trouver le stock à retirer."}
                  </p>
                )}
                {outHasStock && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">En stock (total)</p>
                    <p className="text-base font-semibold text-foreground">{outTotal}</p>
                  </div>
                )}
              </div>

              {/* FEFO lot queue — shows which lots will be consumed, earliest first */}
              {outHasStock && (
                <div className="mb-4 rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted text-xs font-semibold text-foreground">
                    Ordre de sortie (péremption croissante)
                  </div>
                  <ul className="divide-y divide-border max-h-44 overflow-y-auto">
                    {(() => {
                      let remaining = Number(outQty) || 0;
                      return outBatches.map((b) => {
                        const take = Math.max(0, Math.min(remaining, b.stock));
                        remaining -= take;
                        return (
                          <li key={b._id} className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${take > 0 ? "bg-warning/5" : ""}`}>
                            <span className="font-mono text-foreground truncate">{b.batch || "—"}</span>
                            <span className="text-muted-foreground shrink-0">
                              {b.stock} u · exp. {b.expiry ? new Date(b.expiry).toLocaleDateString("fr-FR") : "—"}
                              {take > 0 && <span className="ml-2 font-semibold text-warning">−{take}</span>}
                            </span>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantité à retirer" required>
                    <input
                      type="number"
                      min={0}
                      max={outTotal || undefined}
                      value={outQty}
                      onChange={(e) => { setOutQty(e.target.value); if (saveState !== "idle") setSaveState("idle"); }}
                      placeholder="0"
                      disabled={!outHasStock}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Motif" required>
                    <select
                      value={outReason}
                      onChange={(e) => setOutReason(e.target.value as OutReason)}
                      disabled={!outHasStock}
                      className={inputCls}
                    >
                      <option value="dispense">Dispensé</option>
                      <option value="expired">Périmé</option>
                      <option value="damaged">Endommagé</option>
                    </select>
                  </Field>
                </div>

                <Field label="Note">
                  <input
                    type="text"
                    value={outNote}
                    onChange={(e) => setOutNote(e.target.value)}
                    placeholder="Facultatif"
                    disabled={!outHasStock}
                    className={inputCls}
                  />
                </Field>

                {outHasStock && (
                  <p className="text-xs text-muted-foreground">
                    Nouveau solde total après retrait :{" "}
                    <span className="font-semibold text-foreground">
                      {Math.max(0, outTotal - (Number(outQty) || 0))}
                    </span>.
                  </p>
                )}
              </div>

              <button
                onClick={handleRemove}
                disabled={saveState === "saving" || !outHasStock}
                className="mt-6 w-full bg-warning text-white py-3 rounded-lg font-medium hover:bg-warning/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveState === "saving"
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Retrait...</>
                  : <><PackageMinus className="w-5 h-5" /> Retirer de l'inventaire</>}
              </button>
            </>
          )}
        </div>
      </div>
        </>
      )}

      {/* Order delivery flow — shown when an ORD- code is scanned. */}
      {orderFlow && (
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Confirmation de livraison</h3>
            </div>
            <button onClick={exitOrderFlow} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
              <ArrowLeft className="w-4 h-4" /> Retour au scan
            </button>
          </div>

          {orderState === "looking" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Recherche de la commande…
            </p>
          )}

          {orderState === "notfound" && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-2">
              <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Commande introuvable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {deliverError || `Aucune commande ne correspond au code « ${barcode} ».`}
                </p>
              </div>
            </div>
          )}

          {order && (orderState === "delivered" || orderState === "cancelled") && (
            <div className={`rounded-lg border p-4 ${orderState === "delivered" ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"}`}>
              <p className="text-sm font-medium text-foreground">
                {orderState === "delivered" ? "Commande déjà livrée" : "Commande annulée"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {order.reference}
                {orderState === "delivered" && order.deliveredAt
                  ? ` · Livrée le ${new Date(order.deliveredAt).toLocaleString("fr-FR")}`
                  : " · Aucune action possible."}
              </p>
              {orderState === "delivered" && (
                <ul className="mt-3 space-y-1">
                  {order.lines.map((l) => (
                    <li key={medOf(l.medicationId)._id} className="text-xs text-muted-foreground flex justify-between">
                      <span>{medOf(l.medicationId).name}</span>
                      <span>{l.receivedQuantity}/{l.quantity} reçu</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {order && orderState === "found" && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted">
                <div>
                  <p className="text-sm font-medium text-foreground">{order.reference}</p>
                  <p className="text-xs text-muted-foreground font-mono">{order.orderId}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Fournisseur : {typeof order.supplierId === "object" ? order.supplierId.name : "—"}
                </span>
              </div>

              {deliverError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">{deliverError}</div>
              )}

              <div className="space-y-3">
                {order.lines.map((l) => {
                  const med = medOf(l.medicationId);
                  const remaining = l.quantity - l.receivedQuantity;
                  if (remaining <= 0) {
                    return (
                      <div key={med._id} className="p-3 bg-muted rounded-lg text-sm text-muted-foreground flex justify-between">
                        <span>{med.name}</span><span>Déjà reçu ✓</span>
                      </div>
                    );
                  }
                  const row = deliverRows[med._id];
                  // The sale price rides on the populated medication; warn on a negative margin.
                  const salePrice = typeof l.medicationId === "object" ? (l.medicationId as any).salePrice : undefined;
                  const rowCost = Number(row?.purchasePrice);
                  const rowMarginWarning =
                    typeof salePrice === "number" && Number.isFinite(rowCost) && rowCost > 0 && salePrice < rowCost;
                  const rowUnit = units.find((u) => u._id === row?.storageId);
                  const rowShelfOptions = rowUnit ? rowUnit.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
                  return (
                    <div key={med._id} className="p-3 border border-border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{med.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Commandé : {l.quantity}{l.receivedQuantity ? ` · déjà reçu ${l.receivedQuantity}` : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Field label="Quantité reçue" required>
                          <input type="number" min={1} max={remaining} value={row?.receivedQuantity ?? ""}
                            onChange={(e) => setDeliverField(med._id, { receivedQuantity: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label="Numéro de lot" required>
                          <input value={row?.lotNumber ?? ""} onChange={(e) => setDeliverField(med._id, { lotNumber: e.target.value })}
                            placeholder="BT-2025-001" className={inputCls} />
                        </Field>
                        <Field label="Prix d'achat (DH)" required>
                          <input type="number" min={0} step="0.01" value={row?.purchasePrice ?? ""}
                            onChange={(e) => setDeliverField(med._id, { purchasePrice: e.target.value })} placeholder="0.00" className={inputCls} />
                        </Field>
                        <Field label="Péremption" required>
                          <input type="date" value={row?.expiry ?? ""} onChange={(e) => setDeliverField(med._id, { expiry: e.target.value })} className={inputCls} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Unité de stockage">
                          <select
                            value={row?.storageId ?? ""}
                            onChange={(e) => setDeliverField(med._id, { storageId: e.target.value, shelf: "" })}
                            className={inputCls}
                            disabled={units.length === 0}
                          >
                            <option value="">{units.length ? "— Non assignée —" : "Aucune unité"}</option>
                            {units.map((u) => (
                              <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Étagère">
                          <select
                            value={row?.shelf ?? ""}
                            onChange={(e) => setDeliverField(med._id, { shelf: e.target.value })}
                            disabled={!row?.storageId}
                            className={inputCls}
                          >
                            <option value="">{rowShelfOptions.length ? "— Sélectionner —" : "— Aucune —"}</option>
                            {rowShelfOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      {typeof salePrice === "number" && (
                        <p className="text-xs text-muted-foreground">
                          Prix de vente : <span className="font-medium text-foreground">{salePrice} DH</span>
                        </p>
                      )}
                      {rowMarginWarning && (
                        <div className="p-2 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg">
                          Attention : prix de vente ({salePrice} DH) &lt; prix d'achat ({rowCost} DH) — marge négative.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={confirmDelivery} disabled={deliverSaving}
                className="w-full bg-success text-white py-3 rounded-lg font-medium hover:bg-success/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {deliverSaving
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Confirmation…</>
                  : <><ClipboardCheck className="w-5 h-5" /> Confirmer la livraison</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* Add-new-medication modal (unknown barcode) — barcode is fixed from the
          scan; FDA pre-fills what it can; everything is validated before submit. */}
      <Modal
        open={addMedOpen}
        title="Ajouter un nouveau médicament"
        onClose={() => { setAddMedOpen(false); setNewMedError(null); }}
        footer={
          <>
            <button
              onClick={() => { setAddMedOpen(false); setNewMedError(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent"
            >
              Annuler
            </button>
            <button
              onClick={submitNewMed}
              disabled={newMedSaving}
              className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50 flex items-center gap-2"
            >
              {newMedSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer et ajouter au stock
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {fdaLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Pré-remplissage depuis Open FDA…
            </p>
          )}
          {newMedError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {newMedError}
            </div>
          )}

          <Field label="Code-barres">
            <input value={newMed.barcode} readOnly className={`${inputCls} bg-muted font-mono`} />
          </Field>

          <Field label="Nom" required>
            <input value={newMed.name} onChange={(e) => setNewMedField("name", e.target.value)} placeholder="ex. Amoxicilline 500mg" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie" required>
              <input list="scan-med-categories" value={newMed.category} onChange={(e) => setNewMedField("category", e.target.value)} placeholder="Antibiotique" className={inputCls} />
              <datalist id="scan-med-categories">
                {MEDICINE_CATEGORIES.map((c) => <option key={c.name} value={c.name} />)}
              </datalist>
              {newMed.category.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  Conservation : {CONDITION_META[conditionForCategory(newMed.category)].short}
                </p>
              )}
            </Field>
            <Field label="Fabricant" required>
              <input value={newMed.manufacturer} onChange={(e) => setNewMedField("manufacturer", e.target.value)} placeholder="ex. Sanofi" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Forme galénique" required>
              <input value={newMed.dosageForm} onChange={(e) => setNewMedField("dosageForm", e.target.value)} placeholder="Comprimé" className={inputCls} />
            </Field>
            <Field label="Dosage" required>
              <input value={newMed.strength} onChange={(e) => setNewMedField("strength", e.target.value)} placeholder="500mg" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix de vente (DH)" required>
              <input type="number" min={0} step="0.01" value={newMed.salePrice} onChange={(e) => setNewMedField("salePrice", e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Prix d'achat — 1er lot (DH)" required>
              <input type="number" min={0} step="0.01" value={newMed.purchasePrice} onChange={(e) => setNewMedField("purchasePrice", e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
          </div>
          {newMedMarginWarning && (
            <div className="p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg">
              Attention : le prix de vente est inférieur au prix d'achat — marge négative.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seuil de stock minimum" required>
              <input type="number" min={0} value={newMed.minStock} onChange={(e) => setNewMedField("minStock", e.target.value)} placeholder="10" className={inputCls} />
            </Field>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-2">Premier lot</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Numéro de lot" required>
                <input value={newMed.lotNumber} onChange={(e) => setNewMedField("lotNumber", e.target.value)} placeholder="BT-2025-001" className={inputCls} />
              </Field>
              <Field label="Quantité initiale" required>
                <input type="number" min={1} value={newMed.quantity} onChange={(e) => setNewMedField("quantity", e.target.value)} placeholder="0" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Date de péremption" required>
                <input type="date" value={newMed.expiry} onChange={(e) => setNewMedField("expiry", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Fournisseur">
                <input value={newMed.supplier} onChange={(e) => setNewMedField("supplier", e.target.value)} placeholder="Facultatif" className={inputCls} />
              </Field>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
