import { useMemo, useState } from "react";
import {
  Snowflake,
  Thermometer,
  Lock,
  ShieldAlert,
  Boxes as BoxesIcon,
  Package,
  Layers,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Boxes,
  GripVertical,
  Link2,
} from "lucide-react";
import { useStorage } from "../hooks/useStorage";
import {
  storageService,
  StorageType,
  StorageWithContents,
} from "../../services/storage.service";
import { inventoryService, InventoryItem } from "../../services/inventory.service";
import { formatNumber } from "../lib/inventoryStats";
import { Modal } from "../components/common/Modal";
import { StatusBadges } from "../components/common/StatusBadges";
import { BatchFormModal } from "../components/inventory/BatchFormModal";
import { MedicineConnectionsModal, effectiveStatus, effectiveStatuses } from "../components/inventory/MedicineConnectionsModal";

/** Visual + label metadata per storage type. Section order follows this object. */
const TYPE_META: Record<StorageType, { label: string; icon: typeof Snowflake; badge: string; iconWrap: string }> = {
  cold: { label: "Réfrigéré", icon: Snowflake, badge: "bg-secondary/10 text-secondary", iconWrap: "bg-secondary/10 text-secondary" },
  ambient: { label: "Ambiant", icon: Thermometer, badge: "bg-primary/10 text-primary", iconWrap: "bg-primary/10 text-primary" },
  controlled: { label: "Stupéfiants", icon: Lock, badge: "bg-warning/10 text-warning", iconWrap: "bg-warning/10 text-warning" },
  quarantine: { label: "Quarantaine", icon: ShieldAlert, badge: "bg-destructive/10 text-destructive", iconWrap: "bg-destructive/10 text-destructive" },
  general: { label: "Général", icon: BoxesIcon, badge: "bg-muted text-muted-foreground", iconWrap: "bg-muted text-muted-foreground" },
};
const TYPE_ORDER: StorageType[] = ["cold", "ambient", "controlled", "quarantine", "general"];

const tempLabel = (u: { minTemp?: number; maxTemp?: number }): string | null => {
  if (u.minTemp == null && u.maxTemp == null) return null;
  if (u.minTemp != null && u.maxTemp != null) return `${u.minTemp}–${u.maxTemp} °C`;
  return u.minTemp != null ? `≥ ${u.minTemp} °C` : `≤ ${u.maxTemp} °C`;
};

// ---- Unit (create/edit) form ------------------------------------------------
interface UnitForm {
  name: string;
  type: StorageType;
  shelves: string;
  description: string;
  minTemp: string;
  maxTemp: string;
}
const emptyUnitForm: UnitForm = { name: "", type: "ambient", shelves: "", description: "", minTemp: "", maxTemp: "" };

export function StorageScreen() {
  const { data, loading, error, refetch } = useStorage();
  const { units, unassigned } = data;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Unit modal
  const [unitOpen, setUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StorageWithContents | null>(null);
  const [unitForm, setUnitForm] = useState<UnitForm>(emptyUnitForm);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  // Content (move / edit) modal
  const [contentItem, setContentItem] = useState<InventoryItem | null>(null);
  const [cStorageId, setCStorageId] = useState("");
  const [cShelf, setCShelf] = useState("");
  const [cStock, setCStock] = useState("");
  const [cNote, setCNote] = useState("");
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState<string | null>(null);

  // Add-to-shelf (connected batch form)
  const [addTarget, setAddTarget] = useState<{ storageId: string; shelf: string } | null>(null);

  // Drag-and-drop relocation
  const [dragItem, setDragItem] = useState<InventoryItem | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  // Consolidated "same medicine across locations" details
  const [medDetail, setMedDetail] = useState<string | null>(null);

  // Index every batch by its medication so the same medicine is linked across
  // shelves and units (the connection is the shared medicationId).
  const medIndex = useMemo(() => {
    const m = new Map<string, InventoryItem[]>();
    const add = (it: InventoryItem) => {
      if (!it.medicationId) return;
      const k = String(it.medicationId);
      const list = m.get(k) ?? [];
      list.push(it);
      m.set(k, list);
    };
    for (const u of units) for (const s of u.shelves) for (const it of s.items) add(it);
    for (const it of unassigned) add(it);
    return m;
  }, [units, unassigned]);

  const detailGroup = medDetail ? medIndex.get(medDetail) ?? [] : [];

  // Delete-content modal
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [dReason, setDReason] = useState<"expired" | "damaged" | "correction">("damaged");
  const [dNote, setDNote] = useState("");
  const [dSaving, setDSaving] = useState(false);
  const [dError, setDError] = useState<string | null>(null);

  const unitOptions = useMemo(
    () => units.map((u) => ({ id: u._id, name: u.name, shelves: u.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère") })),
    [units],
  );
  const shelvesForSelected = useMemo(
    () => unitOptions.find((u) => u.id === cStorageId)?.shelves ?? [],
    [unitOptions, cStorageId],
  );

  const grouped = useMemo(() => {
    const map = new Map<StorageType, StorageWithContents[]>();
    for (const u of units) {
      const list = map.get(u.type) ?? [];
      list.push(u);
      map.set(u.type, list);
    }
    return map;
  }, [units]);

  if (loading) return <div className="p-6 text-muted-foreground">Chargement des unités de stockage…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  // ---- Unit handlers --------------------------------------------------------
  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitForm(emptyUnitForm);
    setUnitError(null);
    setUnitOpen(true);
  };
  const openEditUnit = (u: StorageWithContents) => {
    setEditingUnit(u);
    setUnitForm({
      name: u.name,
      type: u.type,
      shelves: u.shelves.map((s) => s.name).filter((n) => n !== "Sans étagère").join("\n"),
      description: u.description ?? "",
      minTemp: u.minTemp != null ? String(u.minTemp) : "",
      maxTemp: u.maxTemp != null ? String(u.maxTemp) : "",
    });
    setUnitError(null);
    setUnitOpen(true);
  };
  const submitUnit = async () => {
    if (!unitForm.name.trim()) {
      setUnitError("Le nom de l'unité est obligatoire.");
      return;
    }
    setUnitSaving(true);
    setUnitError(null);
    const payload = {
      name: unitForm.name.trim(),
      type: unitForm.type,
      shelves: unitForm.shelves,
      description: unitForm.description.trim() || undefined,
      minTemp: unitForm.minTemp === "" ? undefined : Number(unitForm.minTemp),
      maxTemp: unitForm.maxTemp === "" ? undefined : Number(unitForm.maxTemp),
    };
    try {
      if (editingUnit) await storageService.update(editingUnit._id, payload);
      else await storageService.create(payload);
      await refetch();
      setUnitOpen(false);
    } catch (err: any) {
      setUnitError(err.response?.data?.message || "Échec de l'enregistrement de l'unité.");
    } finally {
      setUnitSaving(false);
    }
  };
  const deleteUnit = async (u: StorageWithContents) => {
    if (!window.confirm(`Supprimer l'unité « ${u.name} » ?`)) return;
    try {
      await storageService.delete(u._id);
      await refetch();
    } catch (err: any) {
      alert(err.response?.data?.message || "Échec de la suppression de l'unité.");
    }
  };

  // ---- Content handlers -----------------------------------------------------
  const openContent = (item: InventoryItem) => {
    setContentItem(item);
    setCStorageId(item.storageId ? String(item.storageId) : "");
    setCShelf(item.shelf ?? "");
    setCStock(String(item.stock));
    setCNote("");
    setCError(null);
  };
  const submitContent = async () => {
    if (!contentItem) return;
    if (!cNote.trim()) {
      setCError("Un motif est requis pour modifier le contenu.");
      return;
    }
    setCSaving(true);
    setCError(null);
    try {
      await inventoryService.update(contentItem._id, {
        storageId: cStorageId || null,
        shelf: cStorageId ? cShelf : null,
        stock: Number(cStock),
        note: cNote.trim(),
      });
      await refetch();
      setContentItem(null);
    } catch (err: any) {
      setCError(err.response?.data?.message || "Échec de la mise à jour du contenu.");
    } finally {
      setCSaving(false);
    }
  };

  const openDelete = (item: InventoryItem) => {
    setDeleteItem(item);
    setDReason("damaged");
    setDNote("");
    setDError(null);
  };
  const submitDelete = async () => {
    if (!deleteItem) return;
    if (!dNote.trim()) {
      setDError("Un motif est requis pour supprimer le contenu.");
      return;
    }
    setDSaving(true);
    setDError(null);
    try {
      await inventoryService.delete(deleteItem._id, { reason: dReason, note: dNote.trim() });
      await refetch();
      setDeleteItem(null);
    } catch (err: any) {
      setDError(err.response?.data?.message || "Échec de la suppression du contenu.");
    } finally {
      setDSaving(false);
    }
  };

  // Relocate a dragged batch to a unit + shelf (or to "unassigned" when storageId
  // is empty). A no-op when the destination matches the current spot. The move is
  // auto-logged as a relocation motif so it stays quick yet auditable.
  const relocate = async (item: InventoryItem | null, storageId: string, shelf: string) => {
    if (!item) return;
    const realShelf = shelf === "Sans étagère" ? "" : shelf;
    const sameStorage = String(item.storageId ?? "") === String(storageId ?? "");
    const sameShelf = (item.shelf ?? "") === realShelf;
    if (sameStorage && sameShelf) return;
    setMoving(item._id);
    try {
      await inventoryService.update(item._id, {
        storageId: storageId || null,
        shelf: storageId ? realShelf || null : null,
        note: "Déplacement par glisser-déposer",
      });
      await refetch();
    } catch (err: any) {
      alert(err.response?.data?.message || "Échec du déplacement de l'article.");
    } finally {
      setMoving(null);
    }
  };

  const totalUnitsAll = units.reduce((s, u) => s + u.totalUnits, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Unités de stockage</h2>
          <p className="text-muted-foreground mt-1">
            {units.length} unité(s) · {formatNumber(totalUnitsAll)} unités stockées
            {unassigned.length > 0 && ` · ${unassigned.length} article(s) non assigné(s)`}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5" />
            Glissez-déposez un article pour le déplacer entre étagères et unités.
          </p>
        </div>
        <button onClick={openAddUnit} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Ajouter une unité</span>
        </button>
      </div>

      {units.length === 0 && unassigned.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-10 text-center text-muted-foreground">
          Aucune unité de stockage. Cliquez sur « Ajouter une unité » pour commencer.
        </div>
      )}

      {TYPE_ORDER.map((type) => {
        const list = grouped.get(type);
        if (!list || list.length === 0) return null;
        const meta = TYPE_META[type];
        const SectionIcon = meta.icon;
        return (
          <section key={type} className="space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon className={`w-5 h-5 ${meta.iconWrap.split(" ")[1]}`} />
              <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
              <span className="text-sm text-muted-foreground">({list.length})</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {list.map((u) => (
                <UnitCard
                  key={u._id}
                  unit={u}
                  open={!!expanded[u._id]}
                  onToggle={() => toggle(u._id)}
                  onEditUnit={() => openEditUnit(u)}
                  onDeleteUnit={() => deleteUnit(u)}
                  onEditItem={openContent}
                  onDeleteItem={openDelete}
                  onAddToShelf={(shelf) => setAddTarget({ storageId: u._id, shelf })}
                  isDragging={dragItem !== null}
                  moving={moving}
                  onItemDragStart={setDragItem}
                  onItemDragEnd={() => setDragItem(null)}
                  onDropToShelf={(shelf) => relocate(dragItem, u._id, shelf)}
                  medIndex={medIndex}
                  onShowMed={setMedDetail}
                />
              ))}
            </div>
          </section>
        );
      })}

      {(unassigned.length > 0 || dragItem) && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Non assignés</h3>
            <span className="text-sm text-muted-foreground">({unassigned.length})</span>
          </div>
          <div
            onDragOver={(e) => dragItem && e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); relocate(dragItem, "", ""); }}
            className={`bg-card rounded-lg border divide-y divide-border transition-colors ${
              dragItem ? "border-dashed border-primary/60 bg-primary/5" : "border-border"
            }`}
          >
            {unassigned.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Déposez ici pour retirer d'une unité.</p>
            ) : (
              unassigned.map((item) => (
                <ItemRow
                  key={item._id}
                  item={item}
                  onEdit={() => openContent(item)}
                  onDelete={() => openDelete(item)}
                  assignHint
                  moving={moving === item._id}
                  onDragStart={() => setDragItem(item)}
                  onDragEnd={() => setDragItem(null)}
                  connections={item.medicationId ? (medIndex.get(String(item.medicationId))?.length ?? 1) - 1 : 0}
                  onConnections={item.medicationId ? () => setMedDetail(String(item.medicationId)) : undefined}
                  displayStatuses={effectiveStatuses(item, (item.medicationId && medIndex.get(String(item.medicationId))) || [item])}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* Connected "add a batch" form, locked to the chosen unit + shelf */}
      <BatchFormModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        onSaved={refetch}
        lockStorageId={addTarget?.storageId}
        lockShelf={addTarget?.shelf}
      />

      {/* Unit create/edit modal */}
      <Modal
        open={unitOpen}
        title={editingUnit ? "Modifier l'unité de stockage" : "Ajouter une unité de stockage"}
        onClose={() => setUnitOpen(false)}
        footer={
          <>
            <button onClick={() => setUnitOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={submitUnit} disabled={unitSaving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {unitSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingUnit ? "Enregistrer" : "Ajouter"}
            </button>
          </>
        }
      >
        {unitError && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{unitError}</div>}
        <div className="space-y-3">
          <Field label="Nom de l'unité *">
            <input value={unitForm.name} onChange={(e) => setUnitForm((p) => ({ ...p, name: e.target.value }))} placeholder="ex. Réfrigérateur 1" className={inputCls} />
          </Field>
          <Field label="Type *">
            <select value={unitForm.type} onChange={(e) => setUnitForm((p) => ({ ...p, type: e.target.value as StorageType }))} className={inputCls}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Étagères (une par ligne)">
            <textarea value={unitForm.shelves} onChange={(e) => setUnitForm((p) => ({ ...p, shelves: e.target.value }))} rows={4} placeholder={"A1\nA2\nB1"} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temp. min (°C)">
              <input type="number" value={unitForm.minTemp} onChange={(e) => setUnitForm((p) => ({ ...p, minTemp: e.target.value }))} placeholder="2" className={inputCls} />
            </Field>
            <Field label="Temp. max (°C)">
              <input type="number" value={unitForm.maxTemp} onChange={(e) => setUnitForm((p) => ({ ...p, maxTemp: e.target.value }))} placeholder="8" className={inputCls} />
            </Field>
          </div>
          <Field label="Description">
            <input value={unitForm.description} onChange={(e) => setUnitForm((p) => ({ ...p, description: e.target.value }))} placeholder="Facultatif" className={inputCls} />
          </Field>
        </div>
      </Modal>

      {/* Content move/edit modal */}
      <Modal
        open={contentItem !== null}
        title="Modifier le contenu"
        onClose={() => setContentItem(null)}
        footer={
          <>
            <button onClick={() => setContentItem(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={submitContent} disabled={cSaving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {cSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        {contentItem && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium text-foreground">{contentItem.name}</span>
              <span className="text-sm text-muted-foreground">Lot {contentItem.batch}</span>
            </div>
            {cError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{cError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unité">
                <select value={cStorageId} onChange={(e) => { setCStorageId(e.target.value); setCShelf(""); }} className={inputCls}>
                  <option value="">— Non assigné —</option>
                  {unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Étagère">
                <select value={cShelf} onChange={(e) => setCShelf(e.target.value)} disabled={!cStorageId} className={inputCls}>
                  <option value="">— Aucune —</option>
                  {shelvesForSelected.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Quantité en stock">
              <input type="number" value={cStock} onChange={(e) => setCStock(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Motif *">
              <input value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder="ex. Réorganisation des étagères" className={inputCls} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Delete-content modal */}
      <Modal
        open={deleteItem !== null}
        title="Supprimer le contenu"
        onClose={() => setDeleteItem(null)}
        footer={
          <>
            <button onClick={() => setDeleteItem(null)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Annuler</button>
            <button onClick={submitDelete} disabled={dSaving} className="px-4 py-2 bg-destructive text-white rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2">
              {dSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer
            </button>
          </>
        }
      >
        {deleteItem && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium text-foreground">{deleteItem.name}</span>
              <span className="text-sm text-muted-foreground">{deleteItem.stock} en stock</span>
            </div>
            {dError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{dError}</div>}
            <Field label="Motif (catégorie)">
              <select value={dReason} onChange={(e) => setDReason(e.target.value as typeof dReason)} className={inputCls}>
                <option value="damaged">Endommagé</option>
                <option value="expired">Périmé</option>
                <option value="correction">Correction</option>
              </select>
            </Field>
            <Field label="Motif (détail) *">
              <input value={dNote} onChange={(e) => setDNote(e.target.value)} placeholder="ex. Casse lors de la manutention" className={inputCls} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Le stock restant ({deleteItem.stock}) sera enregistré au journal avant la suppression définitive.
            </p>
          </div>
        )}
      </Modal>

      {/* Consolidated "same medicine across all locations" status */}
      <MedicineConnectionsModal
        open={medDetail !== null}
        onClose={() => setMedDetail(null)}
        items={detailGroup}
      />
    </div>
  );
}

// ---- Subcomponents ----------------------------------------------------------

function UnitCard({
  unit, open, onToggle, onEditUnit, onDeleteUnit, onEditItem, onDeleteItem, onAddToShelf,
  isDragging, moving, onItemDragStart, onItemDragEnd, onDropToShelf, medIndex, onShowMed,
}: {
  unit: StorageWithContents;
  open: boolean;
  onToggle: () => void;
  onEditUnit: () => void;
  onDeleteUnit: () => void;
  onEditItem: (i: InventoryItem) => void;
  onDeleteItem: (i: InventoryItem) => void;
  onAddToShelf: (shelf: string) => void;
  isDragging: boolean;
  moving: string | null;
  onItemDragStart: (i: InventoryItem) => void;
  onItemDragEnd: () => void;
  onDropToShelf: (shelf: string) => void;
  medIndex: Map<string, InventoryItem[]>;
  onShowMed: (medicationId: string) => void;
}) {
  const meta = TYPE_META[unit.type];
  const temp = tempLabel(unit);
  const [dragOverShelf, setDragOverShelf] = useState<string | null>(null);
  const [dragOverHeader, setDragOverHeader] = useState(false);
  const firstShelf = unit.shelves.map((s) => s.name).find((n) => n !== "Sans étagère") ?? "";
  const statusOf = (i: InventoryItem) =>
    effectiveStatus(i, (i.medicationId && medIndex.get(String(i.medicationId))) || [i]);
  const lowOrOut = unit.shelves.reduce(
    (n, s) => n + s.items.filter((i) => { const st = statusOf(i); return st === "low" || st === "out"; }).length,
    0,
  );

  return (
    <div className={`bg-card rounded-lg border transition-colors ${dragOverHeader ? "border-primary ring-1 ring-primary/50" : "border-border"}`}>
      <div
        className="flex items-start justify-between p-5"
        onDragOver={(e) => { if (isDragging) { e.preventDefault(); setDragOverHeader(true); } }}
        onDragLeave={() => setDragOverHeader(false)}
        onDrop={(e) => { e.preventDefault(); setDragOverHeader(false); onDropToShelf(firstShelf); }}
      >
        <button onClick={onToggle} className="flex items-center gap-3 text-left flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.iconWrap}`}>
            <meta.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-foreground">{unit.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unit.shelves.length} étagère(s) · {unit.itemCount} article(s) · {formatNumber(unit.totalUnits)} unités
              {temp && ` · ${temp}`}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {lowOrOut > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-warning mr-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {lowOrOut}
            </span>
          )}
          <button onClick={onEditUnit} className="p-1.5 hover:bg-accent rounded" title="Modifier l'unité">
            <Edit className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onDeleteUnit} className="p-1.5 hover:bg-accent rounded" title="Supprimer l'unité">
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
          <button onClick={onToggle} className="p-1.5 hover:bg-accent rounded" title={open ? "Réduire" : "Développer"}>
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          {unit.shelves.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune étagère définie.</p>
          )}
          {unit.shelves.map((shelf) => {
            const isOver = dragOverShelf === shelf.name;
            return (
              <div
                key={shelf.name}
                onDragOver={(e) => { if (isDragging) { e.preventDefault(); e.stopPropagation(); setDragOverShelf(shelf.name); } }}
                onDragLeave={() => setDragOverShelf((cur) => (cur === shelf.name ? null : cur))}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverShelf(null); onDropToShelf(shelf.name); }}
                className={`rounded-lg p-2 -mx-2 transition-colors ${isOver ? "bg-primary/5 ring-1 ring-primary/50" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{shelf.name}</span>
                  <span className="text-xs text-muted-foreground">({shelf.items.length})</span>
                  {shelf.name !== "Sans étagère" && (
                    <button
                      onClick={() => onAddToShelf(shelf.name)}
                      className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      title="Ajouter un lot sur cette étagère"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  )}
                </div>
                {shelf.items.length === 0 ? (
                  <p className={`text-xs pl-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`}>
                    {isDragging ? "Déposez ici" : "Étagère vide."}
                  </p>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {shelf.items.map((item) => (
                      <ItemRow
                        key={item._id}
                        item={item}
                        onEdit={() => onEditItem(item)}
                        onDelete={() => onDeleteItem(item)}
                        moving={moving === item._id}
                        onDragStart={() => onItemDragStart(item)}
                        onDragEnd={onItemDragEnd}
                        connections={item.medicationId ? (medIndex.get(String(item.medicationId))?.length ?? 1) - 1 : 0}
                        onConnections={item.medicationId ? () => onShowMed(String(item.medicationId)) : undefined}
                        displayStatuses={effectiveStatuses(item, (item.medicationId && medIndex.get(String(item.medicationId))) || [item])}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item, onEdit, onDelete, assignHint, moving, onDragStart, onDragEnd, connections = 0, onConnections, displayStatuses,
}: {
  item: InventoryItem;
  onEdit: () => void;
  onDelete: () => void;
  assignHint?: boolean;
  moving?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  connections?: number;
  onConnections?: () => void;
  displayStatuses?: string[];
}) {
  return (
    <div
      draggable={!moving}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 ${moving ? "opacity-50" : "cursor-grab active:cursor-grabbing"}`}
      title="Glissez pour déplacer vers une autre étagère ou unité"
    >
      <div className="flex items-center gap-3 min-w-0">
        {moving ? (
          <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
        ) : (
          <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        )}
        <Package className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">Lot {item.batch}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {connections > 0 && onConnections && (
          <button
            onClick={onConnections}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20"
            title={`Même médicament dans ${connections} autre(s) emplacement(s) — voir le statut consolidé`}
          >
            <Link2 className="w-3 h-3" /> +{connections}
          </button>
        )}
        <StatusBadges statuses={displayStatuses ?? [item.status]} />
        <span className="text-sm font-medium text-foreground w-10 text-right">{item.stock}</span>
        <button onClick={onEdit} className="p-1.5 hover:bg-accent rounded" title={assignHint ? "Assigner à une étagère" : "Modifier le contenu"}>
          <Edit className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-accent rounded" title="Supprimer le contenu">
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full px-4 py-2 bg-input-background border border-border rounded-lg";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
