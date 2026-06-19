import { useCallback, useEffect, useState } from 'react';
import { storageService, StorageOverview } from '../../services/storage.service';

/** Fetches storage units with their content, exposing a `refetch` for mutations. */
export function useStorage() {
  const [data, setData] = useState<StorageOverview>({ units: [], unassigned: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await storageService.getAll();
      setData(res.data);
      setError(null);
    } catch {
      setError('Échec du chargement des unités de stockage. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
