import { STATUS_META } from "../../lib/inventoryStats";

/**
 * Renders one chip per status so a medicine showing two statuses at once
 * (e.g. "Bientôt périmé" + "Stock faible") surfaces both. Feed it the array
 * from `statusesFor` / `effectiveStatuses`.
 */
export function StatusBadges({ statuses, size = "sm" }: { statuses: string[]; size?: "sm" | "md" }) {
  const pad = size === "md" ? "px-3 py-1" : "px-2 py-0.5";
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((s) => {
        const meta = STATUS_META[s] || STATUS_META.optimal;
        return (
          <span key={s} className={`${pad} rounded-full text-xs font-semibold ${meta.class}`}>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
