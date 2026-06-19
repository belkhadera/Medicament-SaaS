import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, ShoppingCart, Loader2, Send, PackageCheck, XCircle, Trash2, FileText, Pill, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  purchaseOrderService,
  PurchaseOrder,
  PurchaseOrderStatus,
  CreatePOLine,
  ReceiveLine,
} from "../../services/purchaseOrder.service";
import { medicationService, Medication } from "../../services/medication.service";
import { supplierService, Supplier } from "../../services/supplier.service";
import { storageService, StorageWithContents } from "../../services/storage.service";
import { formatCurrency } from "../lib/inventoryStats";
import { printPurchaseOrderDoc } from "../lib/orderDocument";
import { Modal } from "../components/common/Modal";

const STATUS_META: Record<PurchaseOrderStatus, { label: string; class: string }> = {
  draft: { label: "Brouillon", class: "bg-muted text-muted-foreground" },
  ordered: { label: "Commandé", class: "bg-secondary/10 text-secondary" },
  partial: { label: "Partiel", class: "bg-warning/10 text-warning" },
  received: { label: "Reçu", class: "bg-success/10 text-success" },
  cancelled: { label: "Annulé", class: "bg-destructive/10 text-destructive" },
};

const PAGE_SIZE = 20;
const inputCls = "w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm disabled:opacity-60";
const FILTERS: { label: string; value: PurchaseOrderStatus | "all" }[] = [
  { label: "Toutes", value: "all" },
  { label: "Brouillon", value: "draft" },
  { label: "Commandé", value: "ordered" },
  { label: "Partiel", value: "partial" },
  { label: "Reçu / Livré", value: "received" },
  { label: "Annulé", value: "cancelled" },
];

// Helpers to read fields that the API returns either populated or as a raw id.
const supplierName = (po: PurchaseOrder) =>
  typeof po.supplierId === "object" ? po.supplierId.name : "—";
const medName = (m: any) => (typeof m === "object" ? m.name : m);
const medId = (m: any) => (typeof m === "object" ? m._id : m);

export function PurchasingScreen() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [units, setUnits] = useState<StorageWithContents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filters + pagination (server-driven).
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Create-order modal
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<CreatePOLine[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Receive modal
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLine>>({});
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Orders are paginated/filtered server-side; suppliers + meds feed the create form.
  const fetchOrders = async (opts?: { page?: number; status?: PurchaseOrderStatus | "all" }) => {
    const targetPage = opts?.page ?? page;
    const targetStatus = opts?.status ?? statusFilter;
    try {
      const res = await purchaseOrderService.getPage({
        page: targetPage,
        limit: PAGE_SIZE,
        status: targetStatus === "all" ? undefined : targetStatus,
      });
      setOrders(res.data.items);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setError(null);
    } catch {
      setError("Échec du chargement des commandes. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefs = async () => {
    try {
      const [s, m, st] = await Promise.all([
        supplierService.getAll(),
        medicationService.getAll(),
        storageService.getAll(),
      ]);
      setSuppliers(s.data);
      setMeds(m.data);
      setUnits(st.data.units);
    } catch {
      /* refs are only needed for the create / receive forms */
    }
  };

  // Re-fetch from the server after any mutation, preserving page + filter.
  const fetchAll = () => fetchOrders();

  useEffect(() => {
    fetchRefs();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders({ page, status: statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // --- create order ---
  /** The medicine's reference buy price — the default unit cost for an order line. */
  const buyPriceFor = (medicationId: string) =>
    meds.find((m) => m._id === medicationId)?.purchasePrice ?? 0;

  const openCreate = () => {
    setSupplierId(suppliers[0]?._id ?? "");
    // Default the unit cost to the medicine's reference buy price (overridable).
    const firstId = meds[0]?._id ?? "";
    setLines([{ medicationId: firstId, quantity: 1, unitPrice: buyPriceFor(firstId) }]);
    setCreateError(null);
    setCreateOpen(true);
  };

  const setLine = (i: number, patch: Partial<CreatePOLine>) =>
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        // When the line's medicine changes, refresh the unit cost to its buy price.
        if (patch.medicationId !== undefined && patch.medicationId !== l.medicationId) {
          return { ...l, ...patch, unitPrice: buyPriceFor(patch.medicationId) };
        }
        return { ...l, ...patch };
      }),
    );

  const addLine = () =>
    setLines((prev) => {
      const firstId = meds[0]?._id ?? "";
      return [...prev, { medicationId: firstId, quantity: 1, unitPrice: buyPriceFor(firstId) }];
    });

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const createTotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0),
    [lines],
  );

  const handleCreate = async () => {
    if (!supplierId) return setCreateError("Choisissez un fournisseur.");
    if (lines.length === 0 || lines.some((l) => !l.medicationId || l.quantity <= 0)) {
      return setCreateError("Chaque ligne doit comporter un médicament et une quantité supérieure à 0.");
    }
    setCreating(true);
    setCreateError(null);
    try {
      await purchaseOrderService.create({
        supplierId,
        lines: lines.map((l) => ({ medicationId: l.medicationId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      await fetchAll();
      setCreateOpen(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || "Impossible de créer la commande.");
    } finally {
      setCreating(false);
    }
  };

  // --- submit / cancel ---
  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "L'action a échoué.");
    } finally {
      setBusyId(null);
    }
  };

  // --- receive ---
  const openReceive = (po: PurchaseOrder) => {
    const init: Record<string, ReceiveLine> = {};
    for (const l of po.lines) {
      const remaining = l.quantity - l.receivedQuantity;
      if (remaining > 0) {
        init[medId(l.medicationId)] = {
          medicationId: medId(l.medicationId),
          batchNumber: "",
          expiry: "",
          location: "",
          receivedQuantity: remaining,
          // Pre-fill the per-batch cost from the line's negotiated unit price,
          // falling back to the medicine's reference buy price.
          purchasePrice: l.unitPrice && l.unitPrice > 0 ? l.unitPrice : buyPriceFor(medId(l.medicationId)),
          storageId: "",
          shelf: "",
        };
      }
    }
    setReceiveOrder(po);
    setReceiveLines(init);
    setReceiveError(null);
  };

  const setReceiveField = (mid: string, patch: Partial<ReceiveLine>) =>
    setReceiveLines((prev) => ({ ...prev, [mid]: { ...prev[mid], ...patch } }));

  const handleReceive = async () => {
    if (!receiveOrder) return;
    const toSend = Object.values(receiveLines).filter((l) => Number(l.receivedQuantity) > 0);
    if (toSend.length === 0) return setReceiveError("Saisissez une quantité reçue pour au moins une ligne.");
    // Validation mirrors the scan-to-deliver flow.
    if (toSend.some((l) => !l.batchNumber.trim())) {
      return setReceiveError("Chaque ligne reçue doit avoir un numéro de lot.");
    }
    if (toSend.some((l) => { const d = new Date(l.expiry); return !l.expiry || isNaN(d.getTime()) || d.getTime() <= Date.now(); })) {
      return setReceiveError("Chaque ligne reçue doit avoir une date de péremption future.");
    }
    if (toSend.some((l) => !(Number(l.purchasePrice) > 0))) {
      return setReceiveError("Chaque ligne reçue doit avoir un prix d'achat strictement positif.");
    }
    // If a storage unit with shelves is chosen, a shelf must be picked too.
    if (toSend.some((l) => {
      const unit = units.find((u) => u._id === l.storageId);
      const shelfOptions = unit ? unit.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
      return l.storageId && shelfOptions.length > 0 && !l.shelf;
    })) {
      return setReceiveError("Choisissez une étagère pour l'unité de stockage sélectionnée.");
    }
    setReceiving(true);
    setReceiveError(null);
    try {
      await purchaseOrderService.receive(receiveOrder._id, toSend.map((l) => ({
        ...l,
        receivedQuantity: Number(l.receivedQuantity),
        storageId: l.storageId || undefined,
        shelf: l.storageId ? l.shelf || undefined : undefined,
      })));
      await fetchAll();
      setReceiveOrder(null);
    } catch (err: any) {
      setReceiveError(err.response?.data?.message || "Impossible de réceptionner la commande.");
    } finally {
      setReceiving(false);
    }
  };

  if (loading) return <div className="p-6 flex items-center justify-center h-full">Chargement des commandes...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Achats</h2>
          <p className="text-muted-foreground mt-1">Commandez du stock auprès des fournisseurs et réceptionnez-le en inventaire</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Nouvelle commande</span>
        </button>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                {["Référence", "Bon de commande", "Fournisseur", "Articles", "Total", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((po) => {
                const badge = STATUS_META[po.status];
                const itemCount = po.lines.length;
                const isBusy = busyId === po._id;
                return (
                  <tr key={po._id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-mono font-medium text-foreground">{po.reference}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => printPurchaseOrderDoc(po)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-muted hover:bg-accent text-foreground"
                        title="Générer le bon de commande (PDF avec code-barres)"
                      >
                        <FileText className="w-3.5 h-3.5" /> {po.orderId}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{supplierName(po)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{itemCount} ligne(s)</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{formatCurrency(po.totalCost)}</td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.class}`}>{badge.label}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {po.status === "draft" && (
                          <button onClick={() => runAction(po._id, () => purchaseOrderService.submit(po._id))} disabled={isBusy}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20" title="Soumettre la commande">
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Soumettre
                          </button>
                        )}
                        {(po.status === "ordered" || po.status === "partial") && (
                          <button onClick={() => openReceive(po)} disabled={isBusy}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-success/10 text-success hover:bg-success/20" title="Réceptionner la marchandise">
                            <PackageCheck className="w-3.5 h-3.5" /> Réceptionner
                          </button>
                        )}
                        {po.status !== "received" && po.status !== "cancelled" && (
                          <button onClick={() => runAction(po._id, () => purchaseOrderService.cancel(po._id))} disabled={isBusy}
                            className="p-1.5 hover:bg-accent rounded" title="Annuler la commande">
                            <XCircle className="w-4 h-4 text-destructive" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">Aucune commande pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Affichage de <span className="font-medium text-foreground">{orders.length}</span> sur{" "}
            <span className="font-medium text-foreground">{total}</span> commande(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Create order modal */}
      <Modal
        open={createOpen}
        title="Nouvelle commande d'achat"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Créer la commande
            </button>
          </>
        }
      >
        {createError && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{createError}</div>}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fournisseur *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-4 py-2 bg-input-background border border-border rounded-lg">
              <option value="">Sélectionner un fournisseur…</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Lignes</label>
              <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter une ligne</button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={l.medicationId} onChange={(e) => {
                  setLine(i, { medicationId: e.target.value });
                }} className="col-span-6 px-3 py-2 bg-input-background border border-border rounded-lg text-sm">
                  {meds.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
                <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                  placeholder="Qté" className="col-span-2 px-3 py-2 bg-input-background border border-border rounded-lg text-sm" />
                <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })}
                  placeholder="Prix" className="col-span-3 px-3 py-2 bg-input-background border border-border rounded-lg text-sm" />
                <button onClick={() => removeLine(i)} className="col-span-1 p-1.5 hover:bg-accent rounded justify-self-center" title="Supprimer la ligne">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground mr-2">Total :</span>
            <span className="font-semibold text-foreground">{formatCurrency(createTotal)}</span>
          </div>
        </div>
      </Modal>

      {/* Receive modal */}
      <Modal
        open={receiveOrder !== null}
        title={receiveOrder ? `Réceptionner ${receiveOrder.reference}` : "Réceptionner"}
        onClose={() => setReceiveOrder(null)}
        footer={
          <>
            <button onClick={() => setReceiveOrder(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleReceive} disabled={receiving} className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50 flex items-center gap-2">
              {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Réceptionner en inventaire
            </button>
          </>
        }
      >
        {receiveError && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{receiveError}</div>}
        {receiveOrder && (
          <div className="space-y-4">
            {receiveOrder.lines.map((l) => {
              const mid = medId(l.medicationId);
              const remaining = l.quantity - l.receivedQuantity;
              if (remaining <= 0) {
                return (
                  <div key={mid} className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-success/20 bg-success/5 text-sm">
                    <span className="font-medium text-foreground truncate">{medName(l.medicationId)}</span>
                    <span className="flex items-center gap-1.5 text-success shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> Entièrement reçu
                    </span>
                  </div>
                );
              }
              const rl = receiveLines[mid];
              const salePrice = typeof l.medicationId === "object" ? (l.medicationId as any).salePrice : undefined;
              const rowCost = Number(rl?.purchasePrice);
              const marginWarning =
                typeof salePrice === "number" && Number.isFinite(rowCost) && rowCost > 0 && salePrice < rowCost;
              const rowUnit = units.find((u) => u._id === rl?.storageId);
              const rowShelfOptions = rowUnit ? rowUnit.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
              return (
                <div key={mid} className="rounded-lg border border-border overflow-hidden">
                  {/* Line header */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Pill className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground truncate">{medName(l.medicationId)}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-card border border-border text-xs text-muted-foreground shrink-0">
                      {remaining} / {l.quantity} restant
                    </span>
                  </div>

                  {/* Line fields — a single, consistent 2-column grid */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantité reçue" required>
                        <input type="number" min={1} max={remaining} value={rl?.receivedQuantity ?? ""}
                          onChange={(e) => setReceiveField(mid, { receivedQuantity: Number(e.target.value) })} className={inputCls} />
                      </Field>
                      <Field label="Péremption" required>
                        <input type="date" value={rl?.expiry ?? ""} onChange={(e) => setReceiveField(mid, { expiry: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Numéro de lot" required>
                        <input value={rl?.batchNumber ?? ""} onChange={(e) => setReceiveField(mid, { batchNumber: e.target.value })}
                          placeholder="BT-2025-001" className={inputCls} />
                      </Field>
                      <Field label="Prix d'achat (DH)" required>
                        <input type="number" min={0} step="0.01" value={rl?.purchasePrice ?? ""}
                          onChange={(e) => setReceiveField(mid, { purchasePrice: Number(e.target.value) })} placeholder="0.00" className={inputCls} />
                      </Field>
                      <Field label="Unité de stockage">
                        <select value={rl?.storageId ?? ""} onChange={(e) => setReceiveField(mid, { storageId: e.target.value, shelf: "" })}
                          className={inputCls} disabled={units.length === 0}>
                          <option value="">{units.length ? "— Non assignée —" : "Aucune unité"}</option>
                          {units.map((u) => (<option key={u._id} value={u._id}>{u.name}</option>))}
                        </select>
                      </Field>
                      <Field label="Étagère">
                        <select value={rl?.shelf ?? ""} onChange={(e) => setReceiveField(mid, { shelf: e.target.value })}
                          disabled={!rl?.storageId} className={inputCls}>
                          <option value="">{rowShelfOptions.length ? "— Sélectionner —" : "— Aucune —"}</option>
                          {rowShelfOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </Field>
                    </div>

                    {typeof salePrice === "number" && (
                      <p className="text-xs text-muted-foreground">
                        Prix de vente : <span className="font-medium text-foreground">{salePrice} DH</span>
                      </p>
                    )}
                    {marginWarning && (
                      <div className="flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Prix de vente ({salePrice} DH) &lt; prix d'achat ({rowCost} DH) — marge négative.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
