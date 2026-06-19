// Lightweight pub/sub so any inventory mutation (a dispense, a stock receipt,
// an edit or delete) can tell live views — the notification bell, dashboards —
// to refetch instead of showing a stale snapshot taken at mount.
type Listener = () => void;

const listeners = new Set<Listener>();

/** Broadcast that inventory data changed; every subscriber refetches. */
export function notifyInventoryChanged(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to inventory changes. Returns an unsubscribe function. */
export function onInventoryChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
