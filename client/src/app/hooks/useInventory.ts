import { useCallback, useEffect, useState } from 'react';
import { inventoryService, InventoryItem } from '../../services/inventory.service';
import { onInventoryChanged } from '../lib/inventoryEvents';

/**
 * Fetches the full inventory and keeps it live: it refetches whenever an
 * inventory mutation is broadcast (see `inventoryEvents`) and when the user
 * returns to the tab, so consumers never show a stale snapshot. Returns a
 * `refetch` so callers can also pull fresh data on demand.
 */
export function useInventory() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await inventoryService.getAll();
      setData(res.data);
      setError(null);
    } catch {
      setError('Failed to load inventory data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const off = onInventoryChanged(refetch);
    window.addEventListener('focus', refetch);
    return () => {
      off();
      window.removeEventListener('focus', refetch);
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
