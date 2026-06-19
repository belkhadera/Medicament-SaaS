import { useMemo, useState } from "react";
import { Bell, XCircle, Clock, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { useInventory } from "../../hooks/useInventory";
import { useMedications } from "../../hooks/useMedications";
import { daysUntil, isExpired, isExpiringWithin } from "../../lib/inventoryStats";
import { InventoryItem } from "../../../services/inventory.service";

interface Notification {
  id: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info";
  icon: typeof XCircle;
}

const toneClass: Record<Notification["tone"], string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-secondary/10 text-secondary",
};

/**
 * Header notification panel. Derives live stock/expiry alerts from the inventory
 * and surfaces them in a dropdown with an unread-style count badge. Any click
 * (a row or the footer) routes the user to the expiration-tracking screen, the
 * single place where these alerts are actioned.
 */
export function NotificationBell({ onNavigate }: { onNavigate: () => void }) {
  const { data: inventory, refetch } = useInventory();
  const { data: meds, refetch: refetchMeds } = useMedications();
  const [open, setOpen] = useState(false);

  // Opening the panel always pulls the latest data, so a medicine whose state
  // was just resolved (restocked, disposed, edited) never lingers here.
  const toggle = () => {
    setOpen((v) => {
      if (!v) {
        refetch();
        refetchMeds();
      }
      return !v;
    });
  };

  const notifications = useMemo<Notification[]>(() => {
    const list: Notification[] = [];

    // Out-of-stock is judged on the catalogue: an active medicine with 0 total
    // stock. Its lots are deleted once emptied, so it has no inventory rows.
    for (const m of meds) {
      if (m.isActive && (m.totalStock ?? 0) <= 0) {
        list.push({ id: `${m._id}-out`, title: `${m.name} est en rupture de stock`, detail: m.category, tone: "danger", icon: XCircle });
      }
    }

    // Low-stock + expiry come from the live lots. Low-stock is judged once per
    // medication on its TOTAL across lots (a lot empty here but stocked elsewhere
    // is no false alarm; multi-lot meds aren't reported twice). Meds with total 0
    // are out-of-stock, handled above.
    const seenStock = new Set<string>();
    for (const i of inventory as InventoryItem[]) {
      const total = i.medicationTotal ?? i.stock;
      const medKey = i.medicationId ? String(i.medicationId) : i.name;
      if (total > 0 && total < i.minStock && !seenStock.has(medKey)) {
        seenStock.add(medKey);
        list.push({ id: `${medKey}-low`, title: `${i.name} est en stock faible`, detail: `${total}/${i.minStock} unités`, tone: "warning", icon: AlertTriangle });
      }

      // Expiry is per-lot, but only matters while the lot still holds stock —
      // an emptied/disposed lot is already resolved and shouldn't show.
      if (i.stock > 0) {
        if (isExpired(i)) {
          list.push({ id: `${i._id}-exp`, title: `${i.name} est périmé`, detail: `Périmé il y a ${Math.abs(daysUntil(i.expiry))} jour(s) · Lot ${i.batch}`, tone: "danger", icon: XCircle });
        } else if (isExpiringWithin(i, 90)) {
          list.push({ id: `${i._id}-expsoon`, title: `${i.name} périme bientôt`, detail: `Périme dans ${daysUntil(i.expiry)} jour(s) · Lot ${i.batch}`, tone: "info", icon: Clock });
        }
      }
    }
    const rank = { danger: 0, warning: 1, info: 2 };
    return list.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [inventory, meds]);

  const hasCritical = notifications.some((n) => n.tone === "danger");

  // Every notification leads to the same destination: the expiration screen.
  const go = () => {
    setOpen(false);
    onNavigate();
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative p-2 hover:bg-accent rounded-lg"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
              hasCritical ? "bg-destructive" : "bg-warning"
            }`}
          >
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              <span className="text-xs text-muted-foreground">{notifications.length} active(s)</span>
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Tout est en ordre.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={go}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${toneClass[n.tone]}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={go}
              className="w-full flex items-center justify-center gap-1 px-4 py-3 text-sm font-medium text-primary border-t border-border hover:bg-accent"
            >
              Voir toutes les alertes
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
