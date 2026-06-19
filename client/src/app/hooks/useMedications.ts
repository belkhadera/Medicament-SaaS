import { useCallback, useEffect, useState } from 'react';
import { medicationService, Medication } from '../../services/medication.service';
import { onInventoryChanged } from '../lib/inventoryEvents';

/**
 * Fetches the medications catalogue and keeps it live. Each medication carries a
 * server-computed `totalStock`, so this is the source of truth for out-of-stock
 * detection (`totalStock === 0`) — a fully-consumed medicine's lots are deleted,
 * so it has no inventory rows left, only its catalogue entry.
 *
 * Stock changes (dispense / receipt / edit / delete) move `totalStock`, so we
 * refetch on the same inventory-change broadcast the inventory views listen to,
 * plus on tab focus.
 */
export function useMedications() {
  const [data, setData] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await medicationService.getAll();
      setData(res.data);
      setError(null);
    } catch {
      setError('Failed to load medications. Please try again later.');
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
