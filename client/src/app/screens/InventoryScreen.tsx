import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  Download,
  Plus,
  Pill,
  AlertTriangle,
  Edit,
  Trash2,
  Loader2,
  PackagePlus,
  PackageMinus,
  Link2,
  MapPin,
  X,
} from "lucide-react";
import {
  inventoryService,
  InventoryItem,
} from "../../services/inventory.service";
import { storageService, StorageWithContents } from "../../services/storage.service";
import { STATUS_META, statusesFor } from "../lib/inventoryStats";
import { StatusBadges } from "../components/common/StatusBadges";
import {
  CONDITION_META,
  conditionForCategory,
  storageSuitsCondition,
} from "../../services/medicineReference";
import { notifyInventoryChanged } from "../lib/inventoryEvents";
import { Modal } from "../components/common/Modal";
import { BatchFormModal } from "../components/inventory/BatchFormModal";
import { MedicineConnectionsModal } from "../components/inventory/MedicineConnectionsModal";

const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

/**
 * A row's displayed status, judged against the WHOLE medicine: low/out use the
 * server-computed `medicationTotal` (sum of every batch across all pages), while
 * expiry uses this batch's own date. Mirrors the server `deriveStatus` priority.
 */
function statusOf(item: InventoryItem): string {
  const days = Math.ceil((new Date(item.expiry).getTime() - Date.now()) / DAY);
  if (days < 0) return "expired";
  const total = item.medicationTotal ?? item.stock;
  if (total <= 0) return "out";
  if (days <= 90) return "expiring";
  if (total < item.minStock) return "low";
  return "optimal";
}

/**
 * Every status that applies to a row at once (expiry + stock axes), judged
 * against the WHOLE medicine for stock (medicationTotal) and this lot's own
 * expiry. A row can be e.g. "Bientôt périmé" AND "Stock faible".
 */
function statusesOf(item: InventoryItem): string[] {
  return statusesFor({
    stock: item.medicationTotal ?? item.stock,
    minStock: item.minStock,
    expiry: item.expiry,
  });
}

interface InventoryScreenProps {
  searchQuery: string;
  /** Clears the global search box (used to "exit" a locate/search view). */
  onClearSearch?: () => void;
}

interface EditForm {
  batch: string;
  stock: string;
  minStock: string;
  expiry: string;
  storageId: string;
  shelf: string;
  note: string;
}

const emptyEdit: EditForm = { batch: "", stock: "", minStock: "", expiry: "", storageId: "", shelf: "", note: "" };

function toEdit(item: InventoryItem): EditForm {
  return {
    batch: item.batch,
    stock: String(item.stock),
    minStock: String(item.minStock),
    expiry: item.expiry ? new Date(item.expiry).toISOString().slice(0, 10) : "",
    storageId: item.storageId ? String(item.storageId) : "",
    shelf: item.shelf ?? "",
    note: "",
  };
}

const inputCls = "w-full px-4 py-2 bg-input-background border border-border rounded-lg disabled:opacity-60";

export function InventoryScreen({ searchQuery, onClearSearch }: InventoryScreenProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<StorageWithContents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The full inventory is loaded once; the status chips, counts, filtering and
  // pagination are all derived on the client so they reflect every lot.
  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [addOpen, setAddOpen] = useState(false);

  // Consolidated "same medicine across locations" details
  const [medDetail, setMedDetail] = useState<string | null>(null);

  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<EditForm>(emptyEdit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stock-movement modal (receive / remove from storage).
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockMode, setStockMode] = useState<"in" | "out">("out");
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("dispense");
  const [stockNote, setStockNote] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const fetchInventory = async () => {
    try {
      const res = await inventoryService.getAll();
      setInventory(res.data);
      setError(null);
    } catch {
      setError("Échec du chargement de l'inventaire. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await storageService.getAll();
      setUnits(res.data.units);
    } catch {
      /* storage units are optional context for the edit form */
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any change to the search or the active filters returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeStatus, categoryFilter, locationFilter]);

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm(toEdit(item));
    setFormError(null);
  };

  const setField = (k: keyof EditForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const editShelfOptions = useMemo(() => {
    const u = units.find((x) => x._id === form.storageId);
    return u ? u.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") : [];
  }, [units, form.storageId]);

  // Warn (don't block) if the chosen unit doesn't match the medicine's required
  // storage condition (e.g. a cold-chain medicine relocated to an ambient unit).
  const editStorageWarning = useMemo(() => {
    if (!editing || !form.storageId) return null;
    const unit = units.find((u) => u._id === form.storageId);
    if (!unit) return null;
    const condition = editing.storageCondition ?? conditionForCategory(editing.category);
    if (storageSuitsCondition(condition, unit.type)) return null;
    return { condition, unitName: unit.name, unitType: unit.type };
  }, [editing, form.storageId, units]);

  const handleEditSubmit = async () => {
    if (!editing) return;
    if (!form.batch || !form.stock || !form.expiry) {
      setFormError("Le lot, la quantité et la péremption sont obligatoires.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await inventoryService.update(editing._id, {
        batch: form.batch.trim(),
        stock: Number(form.stock),
        minStock: form.minStock ? Number(form.minStock) : undefined,
        expiry: form.expiry,
        storageId: form.storageId || null,
        shelf: form.storageId ? form.shelf || null : null,
        note: form.note.trim() || undefined,
      });
      await fetchInventory();
      notifyInventoryChanged();
      setEditing(null);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Échec de l'enregistrement. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Supprimer « ${item.name} » ? Cette action est irréversible.`)) return;
    setDeletingId(item._id);
    try {
      await inventoryService.delete(item._id);
      await fetchInventory();
      notifyInventoryChanged();
    } catch {
      alert("Échec de la suppression de l'article.");
    } finally {
      setDeletingId(null);
    }
  };

  const openStock = (item: InventoryItem, mode: "in" | "out") => {
    setStockItem(item);
    setStockMode(mode);
    setStockQty("");
    setStockReason(mode === "out" ? "dispense" : "scan_in");
    setStockNote("");
    setStockError(null);
  };

  const handleStockSubmit = async () => {
    if (!stockItem) return;
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      setStockError("Saisissez une quantité supérieure à 0.");
      return;
    }
    if (stockMode === "out" && qty > stockItem.stock) {
      setStockError(`Seulement ${stockItem.stock} en stock.`);
      return;
    }
    setStockSaving(true);
    setStockError(null);
    try {
      if (stockMode === "in") {
        await inventoryService.stockIn({
          itemId: stockItem._id,
          quantity: qty,
          reason: stockReason === "receipt" ? "receipt" : "scan_in",
          note: stockNote.trim() || undefined,
        });
      } else {
        await inventoryService.stockOut({
          itemId: stockItem._id,
          quantity: qty,
          reason: stockReason as "dispense" | "expired" | "damaged",
          note: stockNote.trim() || undefined,
        });
      }
      await fetchInventory();
      notifyInventoryChanged();
      setStockItem(null);
    } catch (err: any) {
      setStockError(err.response?.data?.message || "Échec de la mise à jour du stock. Veuillez réessayer.");
    } finally {
      setStockSaving(false);
    }
  };

  // Link every batch of the same medication so a medicine split across
  // lots/locations can show its connections (the link is medicationId).
  const medIndex = useMemo(() => {
    const m = new Map<string, InventoryItem[]>();
    for (const it of inventory) {
      if (!it.medicationId) continue;
      if (it.stock <= 0) continue; // empty lots hold no location — exclude them
      const k = String(it.medicationId);
      const list = m.get(k) ?? [];
      list.push(it);
      m.set(k, list);
    }
    return m;
  }, [inventory]);
  const detailGroup = medDetail ? medIndex.get(medDetail) ?? [] : [];

  // Distinct categories / locations for the advanced-filters panel.
  const categories = useMemo(
    () => [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [inventory],
  );
  const locations = useMemo(
    () => [...new Set(inventory.map((i) => i.location).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [inventory],
  );

  // Search + advanced filters, but NOT the status chip — so each chip can show
  // how many items match in that state given everything else.
  const baseFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((i) => {
      // Empty lots hold no stock and were freed from their shelf on stock-out,
      // so they're hidden here to stay consistent with the Storage view.
      if (i.stock <= 0) return false;
      // Out-of-stock medicines are removed from the inventory view — they're
      // surfaced (and reordered) from the Alertes screen instead.
      if (statusOf(i) === "out") return false;
      if (q) {
        const hay = `${i.name} ${i.category} ${i.barcode ?? ""} ${i.batch}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (locationFilter !== "all" && i.location !== locationFilter) return false;
      return true;
    });
  }, [inventory, searchQuery, categoryFilter, locationFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { low: 0, expiring: 0, out: 0, expired: 0 };
    // A row counts toward EVERY status it carries (e.g. expiring + low).
    for (const i of baseFiltered) {
      for (const s of statusesOf(i)) if (s in c) c[s] += 1;
    }
    return c;
  }, [baseFiltered]);

  const filtered = useMemo(
    () => (activeStatus ? baseFiltered.filter((i) => statusesOf(i).includes(activeStatus)) : baseFiltered),
    [baseFiltered, activeStatus],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive = categoryFilter !== "all" || locationFilter !== "all";

  const resetFilters = () => {
    setCategoryFilter("all");
    setLocationFilter("all");
  };

  // Return the screen to its default state: clears the search/locate term plus
  // every active filter and status chip, so one click restores the full list.
  const returnToDefault = () => {
    setActiveStatus(null);
    setCategoryFilter("all");
    setLocationFilter("all");
    onClearSearch?.();
  };

  const trimmedSearch = searchQuery.trim();

  // Export the currently filtered rows to a CSV the browser downloads.
  const exportCsv = () => {
    const headers = ["Médicament", "Catégorie", "Lot", "Stock", "Emplacement", "Péremption", "Statut"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = filtered.map((i) =>
      [
        i.name,
        i.category,
        i.batch,
        String(i.stock),
        i.location ?? "",
        i.expiry ? new Date(i.expiry).toLocaleDateString("fr-FR") : "",
        statusesOf(i).map((s) => STATUS_META[s]?.label ?? s).join(" + "),
      ]
        .map((c) => escape(String(c)))
        .join(","),
    );
    // BOM so Excel reads the accented French headers correctly.
    const csv = "﻿" + [headers.map(escape).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventaire-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-full">Chargement de l'inventaire...</div>;
  }
  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Gestion de l'inventaire</h2>
          <p className="text-muted-foreground mt-1">Gérez tout le stock de médicaments et les lots</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent ${
              showFilters || filtersActive ? "border-primary text-primary" : "border-border"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filtres{filtersActive ? " (actifs)" : ""}</span>
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Exporter</span>
          </button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Ajouter un lot</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <FilterChip label="Tous" active={activeStatus === null} count={baseFiltered.length} onClick={() => setActiveStatus(null)} />
        <FilterChip label="Stock faible" active={activeStatus === "low"} count={statusCounts.low} onClick={() => setActiveStatus(activeStatus === "low" ? null : "low")} />
        <FilterChip label="Bientôt périmé" active={activeStatus === "expiring"} count={statusCounts.expiring} onClick={() => setActiveStatus(activeStatus === "expiring" ? null : "expiring")} />
        <FilterChip label="Périmé" active={activeStatus === "expired"} count={statusCounts.expired} onClick={() => setActiveStatus(activeStatus === "expired" ? null : "expired")} />
      </div>

      {trimmedSearch && (
        <div className="flex items-center justify-between gap-4 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 text-sm text-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">
              Résultats pour <span className="font-semibold">« {trimmedSearch} »</span>
              {" — "}
              {filtered.length} médicament(s)
            </span>
          </div>
          <button
            onClick={returnToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card rounded text-sm hover:bg-accent shrink-0"
            title="Effacer la recherche et afficher tout l'inventaire"
          >
            <X className="w-4 h-4" />
            Afficher tout l'inventaire
          </button>
        </div>
      )}

      {showFilters && (
        <div className="bg-card rounded-lg border border-border p-4 flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Catégorie</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 bg-input-background border border-border rounded-lg text-sm min-w-44">
              <option value="all">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Emplacement</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2 bg-input-background border border-border rounded-lg text-sm min-w-44">
              <option value="all">Tous les emplacements</option>
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent">
              <X className="w-4 h-4" /> Réinitialiser
            </button>
          )}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                {["Médicament", "Catégorie", "Lot", "Stock", "Emplacement", "Péremption", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((item) => (
                <tr key={item._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Pill className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{item.name}</span>
                      {(() => {
                        const others = item.medicationId ? (medIndex.get(String(item.medicationId))?.length ?? 1) - 1 : 0;
                        if (others <= 0) return null;
                        return (
                          <button
                            onClick={() => setMedDetail(String(item.medicationId))}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20"
                            title={`Même médicament dans ${others} autre(s) emplacement(s) — voir le statut consolidé`}
                          >
                            <Link2 className="w-3 h-3" /> +{others}
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{item.category}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{item.batch}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.stock}</span>
                      {statusesOf(item).some((s) => s === "low" || s === "out") && <AlertTriangle className="w-4 h-4 text-warning" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{item.location}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(item.expiry).toLocaleDateString("fr-FR")}</td>
                  <td className="px-6 py-4"><StatusBadges statuses={statusesOf(item)} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openStock(item, "in")} className="p-1.5 hover:bg-accent rounded" title="Réceptionner du stock">
                        <PackagePlus className="w-4 h-4 text-success" />
                      </button>
                      <button onClick={() => openStock(item, "out")} className="p-1.5 hover:bg-accent rounded" title="Retirer du stock">
                        <PackageMinus className="w-4 h-4 text-warning" />
                      </button>
                      <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-accent rounded" title="Modifier">
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(item)} disabled={deletingId === item._id} className="p-1.5 hover:bg-accent rounded" title="Supprimer">
                        {deletingId === item._id
                          ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                          : <Trash2 className="w-4 h-4 text-destructive" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun médicament trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Affichage de <span className="font-medium text-foreground">{paged.length}</span> sur{" "}
            <span className="font-medium text-foreground">{filtered.length}</span> résultat(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Connected "add a batch" form */}
      <BatchFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { fetchInventory(); fetchUnits(); notifyInventoryChanged(); }}
      />

      {/* Consolidated "same medicine across all locations" status */}
      <MedicineConnectionsModal
        open={medDetail !== null}
        onClose={() => setMedDetail(null)}
        items={detailGroup}
      />

      {/* Edit batch (medication locked) */}
      <Modal
        open={editing !== null}
        title="Modifier le lot"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button onClick={() => setEditing(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleEditSubmit} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium text-foreground">{editing.name}</span>
              <span className="text-sm text-muted-foreground">{editing.category}</span>
            </div>
            {formError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Numéro de lot *">
                <input value={form.batch} onChange={(e) => setField("batch", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Quantité *">
                <input type="number" value={form.stock} onChange={(e) => setField("stock", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock min">
                <input type="number" value={form.minStock} onChange={(e) => setField("minStock", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Péremption *">
                <input type="date" value={form.expiry} onChange={(e) => setField("expiry", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unité de stockage">
                <select value={form.storageId} onChange={(e) => setForm((p) => ({ ...p, storageId: e.target.value, shelf: "" }))} className={inputCls}>
                  <option value="">— Non assigné —</option>
                  {units.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Étagère">
                <select value={form.shelf} onChange={(e) => setField("shelf", e.target.value)} disabled={!form.storageId} className={inputCls}>
                  <option value="">{editShelfOptions.length ? "— Sélectionner —" : "— Aucune —"}</option>
                  {editShelfOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            {editStorageWarning && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
                Attention : « {editing.name} » doit être conservé en <strong>{CONDITION_META[editStorageWarning.condition].label}</strong> ({CONDITION_META[editStorageWarning.condition].tempRange}), mais l'unité « {editStorageWarning.unitName} » est de type « {editStorageWarning.unitType} ».
              </div>
            )}
            <Field label="Motif (si déplacement ou ajustement)">
              <input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Facultatif — enregistré au journal" className={inputCls} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={stockItem !== null}
        title={stockMode === "in" ? "Réceptionner du stock" : "Retirer du stock"}
        onClose={() => setStockItem(null)}
        footer={
          <>
            <button onClick={() => setStockItem(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button
              onClick={handleStockSubmit}
              disabled={stockSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2 ${
                stockMode === "in" ? "bg-success hover:bg-success/90" : "bg-warning hover:bg-warning/90"
              }`}
            >
              {stockSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : stockMode === "in" ? <PackagePlus className="w-4 h-4" /> : <PackageMinus className="w-4 h-4" />}
              {stockMode === "in" ? "Réceptionner" : "Retirer"}
            </button>
          </>
        }
      >
        {stockItem && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium text-foreground">{stockItem.name}</span>
              <span className="text-sm text-muted-foreground">En stock : <span className="font-semibold text-foreground">{stockItem.stock}</span></span>
            </div>

            {stockError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{stockError}</div>
            )}

            {/* Direction toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setStockMode("in"); setStockReason("scan_in"); }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium ${
                  stockMode === "in" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <PackagePlus className="w-4 h-4" /> Réceptionner
              </button>
              <button
                onClick={() => { setStockMode("out"); setStockReason("dispense"); }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium ${
                  stockMode === "out" ? "border-warning bg-warning/10 text-warning" : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <PackageMinus className="w-4 h-4" /> Retirer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantité *">
                <input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" className={inputCls} />
              </Field>
              <Field label="Motif">
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className={inputCls}
                >
                  {stockMode === "in" ? (
                    <>
                      <option value="scan_in">Entrée de stock</option>
                      <option value="receipt">Réception fournisseur</option>
                    </>
                  ) : (
                    <>
                      <option value="dispense">Dispensé</option>
                      <option value="expired">Périmé</option>
                      <option value="damaged">Endommagé</option>
                    </>
                  )}
                </select>
              </Field>
            </div>

            <Field label="Note">
              <input
                type="text"
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder="Facultatif"
                className={inputCls}
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              Le nouveau solde sera de{" "}
              <span className="font-semibold text-foreground">
                {Math.max(0, stockItem.stock + (stockMode === "in" ? 1 : -1) * (Number(stockQty) || 0))}
              </span>.
            </p>
          </div>
        )}
      </Modal>
    </div>
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

function FilterChip({ label, active, count, onClick }: { label: string; active?: boolean; count?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
      {label} {count !== undefined && `(${count})`}
    </button>
  );
}
