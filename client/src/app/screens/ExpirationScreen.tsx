import { useMemo, useState } from 'react';
import { XCircle, Clock, AlertTriangle, Pill, MapPin, PackageX, TrendingDown, ShoppingCart, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { AlertCard } from '../components/common/AlertCard';
import { OrderFormModal } from '../components/inventory/OrderFormModal';
import { useInventory } from '../hooks/useInventory';
import { useMedications } from '../hooks/useMedications';
import { daysUntil, isExpired, isExpiringWithin } from '../lib/inventoryStats';
import { InventoryItem } from '../../services/inventory.service';
import { Medication } from '../../services/medication.service';

interface ExpirationScreenProps {
  /** Jump to the inventory screen pre-searched to a medicine/lot ("locate"). */
  onLocate?: (query: string) => void;
  /** Jump to the medicines catalogue pre-searched (used for out-of-stock items). */
  onLocateCatalog?: (query: string) => void;
}

/** Total stock across every lot of an item's medication (falls back to its own). */
const medTotal = (i: InventoryItem) => i.medicationTotal ?? i.stock;

/**
 * Render an out-of-stock catalogue medication as the InventoryItem shape the
 * alert list expects. A fully-consumed medicine has no batch (the empty lot is
 * deleted), so there's no inventory row — we synthesize one from the catalogue.
 */
function outOfStockItem(med: Medication): InventoryItem {
  return {
    _id: med._id,
    name: med.name,
    category: med.category,
    barcode: med.barcode,
    batch: '',
    stock: 0,
    minStock: med.defaultMinStock,
    salePrice: med.salePrice,
    purchasePrice: 0,
    expiry: '',
    status: 'out',
    location: '',
    medicationId: med._id,
    medicationTotal: 0,
  };
}

export function ExpirationScreen({ onLocate, onLocateCatalog }: ExpirationScreenProps) {
  const { data: inventory, loading, error } = useInventory();
  const { data: meds } = useMedications();
  const [orderMed, setOrderMed] = useState<Medication | null>(null);

  // The catalogue resolves a medication from a flagged lot (so "Commander" can
  // pre-fill a purchase order) AND is the source of truth for out-of-stock.
  const medById = useMemo(() => {
    const m = new Map<string, Medication>();
    for (const med of meds) m.set(String(med._id), med);
    return m;
  }, [meds]);

  // Out-of-stock is judged on the catalogue: an active medicine whose total
  // on-hand stock is 0. (Its lots are deleted once emptied, so it has no rows.)
  const outOfStock = useMemo<InventoryItem[]>(
    () => meds.filter((m) => m.isActive && (m.totalStock ?? 0) <= 0).map(outOfStockItem),
    [meds],
  );

  const { lowStock, expired, expiring30, expiring30to90, expiring90 } = useMemo(() => {
    // Low-stock is judged once per medication on its TOTAL across lots (a lot
    // empty here but stocked elsewhere isn't a false alarm; multi-lot meds aren't
    // reported twice). Meds with total 0 are out-of-stock, handled above.
    const seen = new Set<string>();
    const low: InventoryItem[] = [];
    for (const i of inventory) {
      const key = i.medicationId ? String(i.medicationId) : i.name;
      if (seen.has(key)) continue;
      const total = medTotal(i);
      if (total > 0 && total < i.minStock) {
        seen.add(key);
        low.push(i);
      }
    }

    // Expiry alerts are per-lot, but only while the lot still holds stock — an
    // emptied/disposed lot is already resolved.
    const stocked = inventory.filter((i) => i.stock > 0);
    return {
      lowStock: low,
      expired: stocked.filter(isExpired),
      expiring30: stocked.filter((i) => isExpiringWithin(i, 30)),
      // Non-overlapping middle tier (31–90 days) so each item is listed once.
      expiring30to90: stocked.filter((i) => isExpiringWithin(i, 90) && !isExpiringWithin(i, 30)),
      expiring90: stocked.filter((i) => isExpiringWithin(i, 90)),
    };
  }, [inventory]);

  const totalWarnings =
    outOfStock.length + lowStock.length + expired.length + expiring90.length;

  // Open the "commander" pop-up for a flagged lot's medication.
  const handleOrder = (item: InventoryItem) => {
    const med = item.medicationId ? medById.get(String(item.medicationId)) : undefined;
    if (med) setOrderMed(med);
    else toast.error("Médicament introuvable dans le catalogue — impossible de commander.");
  };

  if (loading) return <div className="p-6 text-muted-foreground">Chargement des alertes…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Alertes & avertissements</h2>
        <p className="text-muted-foreground mt-1">
          Tous les états anormaux du stock — ruptures, stocks faibles et péremptions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AlertCard title="Rupture de stock" count={outOfStock.length} description="Réapprovisionner d'urgence" variant="danger" icon={PackageX} />
        <AlertCard title="Périmés" count={expired.length} description="Action immédiate requise" variant="danger" icon={XCircle} />
        <AlertCard title="Stock faible" count={lowStock.length} description="Sous le seuil minimum" variant="warning" icon={TrendingDown} />
        <AlertCard title="Périment sous 30 jours" count={expiring30.length} description="À examiner et planifier" variant="warning" icon={Clock} />
        <AlertCard title="Périment sous 90 jours" count={expiring90.length} description="À surveiller de près" variant="info" icon={AlertTriangle} />
      </div>

      {outOfStock.length > 0 && (
        <Section title="Rupture de stock" items={outOfStock} tone="danger" kind="out" onLocateCatalog={onLocateCatalog} onOrder={handleOrder} />
      )}
      {expired.length > 0 && (
        <Section title="Médicaments périmés" items={expired} tone="danger" kind="expiry" onLocate={onLocate} />
      )}
      {lowStock.length > 0 && (
        <Section title="Stock faible" items={lowStock} tone="warning" kind="low" onLocate={onLocate} onOrder={handleOrder} />
      )}
      {expiring30.length > 0 && (
        <Section title="Périment sous 30 jours" items={expiring30} tone="warning" kind="expiry" onLocate={onLocate} />
      )}
      {expiring30to90.length > 0 && (
        <Section title="Périment dans 31 à 90 jours" items={expiring30to90} tone="info" kind="expiry" onLocate={onLocate} />
      )}

      {totalWarnings === 0 && (
        <div className="bg-card rounded-lg border border-border p-6 text-sm text-muted-foreground">
          Aucune alerte : tout le stock est dans un état normal.
        </div>
      )}

      <OrderFormModal open={orderMed !== null} onClose={() => setOrderMed(null)} medication={orderMed} />
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  kind,
  onLocate,
  onLocateCatalog,
  onOrder,
}: {
  title: string;
  items: InventoryItem[];
  tone: 'danger' | 'warning' | 'info';
  /** Drives the detail line and which actions are offered. */
  kind: 'expiry' | 'low' | 'out';
  onLocate?: (query: string) => void;
  onLocateCatalog?: (query: string) => void;
  onOrder?: (item: InventoryItem) => void;
}) {
  const wrap = {
    danger: 'border-destructive/20 bg-destructive/5',
    warning: 'border-warning/20 bg-warning/5',
    info: 'border-secondary/20 bg-secondary/5',
  }[tone];
  const iconWrap = {
    danger: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-secondary/10 text-secondary',
  }[tone];

  const actionBtn = 'flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card rounded text-sm hover:bg-accent shrink-0';

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">{title} ({items.length})</h3>
      <div className="space-y-3">
        {items.map((item) => {
          const d = daysUntil(item.expiry);
          const total = medTotal(item);
          const detail =
            kind === 'expiry'
              ? `Lot : ${item.batch} · ${d < 0 ? `Périmé il y a ${Math.abs(d)} jour(s)` : `Périme dans ${d} jour(s)`} · ${new Date(item.expiry).toLocaleDateString('fr-FR')}`
              : kind === 'out'
                ? `${item.category} · Rupture de stock (seuil min. ${item.minStock})`
                : `${item.category} · Stock total : ${total}/${item.minStock} unité(s)`;
          return (
            <div key={item._id} className={`flex items-center justify-between gap-4 p-4 border rounded-lg ${wrap}`}>
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
                  <Pill className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">{detail}</p>
                  {kind === 'out' ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Retiré de l'inventaire — à commander pour réapprovisionner.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.location || 'Emplacement non défini'} · {item.stock} unité(s) dans ce lot
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {kind === 'out' && onLocateCatalog && (
                  <button onClick={() => onLocateCatalog(item.name)} className={actionBtn} title="Voir ce médicament dans le catalogue">
                    <Tags className="w-4 h-4" />
                    Voir dans le catalogue
                  </button>
                )}
                {kind !== 'out' && onLocate && (
                  <button onClick={() => onLocate(item.name)} className={actionBtn} title="Localiser ce médicament dans l'inventaire">
                    <MapPin className="w-4 h-4" />
                    Localiser dans l'inventaire
                  </button>
                )}
                {onOrder && (
                  <button onClick={() => onOrder(item)} className={actionBtn} title="Commander ce médicament">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    Commander
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
