import { MapPin, CalendarClock } from "lucide-react";
import { Modal } from "../common/Modal";
import { InventoryItem } from "../../../services/inventory.service";
import { formatNumber, daysUntil, primaryStatus, STATUS_SEVERITY, InventoryStatus } from "../../lib/inventoryStats";
import { StatusBadges } from "../common/StatusBadges";

/**
 * The statuses (expiry AND stock axes — both can apply at once) for a single lot
 * judged in the context of its whole medicine.
 *
 * Expiry (expired / expiring) is lot-specific, judged on this lot's own date.
 * Stock (out / low) is a MEDICINE-level concern — stock split across several
 * shelves doesn't mean you're low — so it's judged on the medicine's TOTAL
 * on-hand vs its reorder point (the shared per-batch minStock).
 */
export function effectiveStatuses(item: InventoryItem, group: InventoryItem[]): string[] {
  const total = group.reduce((s, i) => s + i.stock, 0);
  const threshold = group.reduce((m, i) => Math.max(m, i.minStock || 0), 0);
  const d = daysUntil(item.expiry);
  const list: string[] = [];
  if (d < 0) list.push("expired");
  else if (d <= 90) list.push("expiring");
  if (total <= 0) list.push("out");
  else if (total < threshold) list.push("low");
  return list.length ? list : ["optimal"];
}

/** Single most-severe status for one lot (filtering / sorting). */
export function effectiveStatus(item: InventoryItem, group: InventoryItem[]): string {
  return primaryStatus(effectiveStatuses(item, group) as InventoryStatus[]);
}

/** Roll up every batch of one medication (across all shelves/units) into the
 *  statuses that apply: stock from the TOTAL, expiry from the worst lot. */
export function consolidate(items: InventoryItem[]) {
  let total = 0;
  let threshold = 0;
  let anyExpired = false;
  let anyExpiring = false;
  let earliest: string | null = null;
  for (const it of items) {
    total += it.stock;
    threshold = Math.max(threshold, it.minStock || 0);
    const d = daysUntil(it.expiry);
    if (d < 0) anyExpired = true;
    else if (d <= 90) anyExpiring = true;
    if (it.expiry && (!earliest || new Date(it.expiry) < new Date(earliest))) earliest = it.expiry;
  }
  const statuses: string[] = [];
  if (anyExpired) statuses.push("expired");
  else if (anyExpiring) statuses.push("expiring");
  if (total <= 0) statuses.push("out");
  else if (total < threshold) statuses.push("low");
  if (!statuses.length) statuses.push("optimal");
  return {
    total,
    statuses,
    worst: primaryStatus(statuses as InventoryStatus[]),
    locations: items.length,
    earliest,
  };
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

interface Props {
  open: boolean;
  onClose: () => void;
  /** Every batch of the same medication, across all shelves/units. */
  items: InventoryItem[];
}

/**
 * Consolidated status for one medicine, linking all its batches even when they
 * sit on different shelves, units, or are unassigned. Shared by the Storage and
 * Inventory screens so the "same medicine across locations" view is identical.
 */
export function MedicineConnectionsModal({ open, onClose, items }: Props) {
  const title = items[0]?.name ?? "Détails du médicament";
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Fermer</button>
      }
    >
      {(() => {
        // Only lots that still hold stock occupy a location — empty lots are
        // freed from storage on stock-out, so the inventory view hides them too.
        const lots = items.filter((i) => i.stock > 0);
        if (lots.length === 0) return null;
        const sum = consolidate(lots);
        const rows = [...lots].sort(
          (a, b) =>
            STATUS_SEVERITY.indexOf(primaryStatus(effectiveStatuses(a, lots) as InventoryStatus[])) -
            STATUS_SEVERITY.indexOf(primaryStatus(effectiveStatuses(b, lots) as InventoryStatus[])),
        );
        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Stock total">
                <span className="text-lg font-semibold text-foreground">{formatNumber(sum.total)}</span>
              </Stat>
              <Stat label="Statut global">
                <StatusBadges statuses={sum.statuses} />
              </Stat>
              <Stat label="Emplacements">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {sum.locations}
                </span>
              </Stat>
              <Stat label="Péremption la plus proche">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" /> {fmtDate(sum.earliest)}
                </span>
              </Stat>
            </div>

            {/* Per-location breakdown */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Présent dans {sum.locations} emplacement(s)
              </p>
              <div className="rounded-lg border border-border divide-y divide-border">
                {rows.map((it) => {
                  return (
                    <div key={it._id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {it.location || "Sans emplacement"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          Lot {it.batch} · exp. {fmtDate(it.expiry)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadges statuses={effectiveStatuses(it, lots)} />
                        <span className="text-sm font-medium text-foreground w-10 text-right">{it.stock}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-muted">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}
