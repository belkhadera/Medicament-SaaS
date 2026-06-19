import { api } from './api';

export interface Medication {
  _id: string;
  name: string;
  category: string;
  barcode?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
  defaultMinStock: number;
  /** Sale price (catalog-level). */
  salePrice: number;
  /**
   * Reference buy/cost price (catalog-level) used to pre-fill purchase orders.
   * Kept in sync with the latest received lot's cost; the actual per-delivery
   * cost still lives on each batch. May be 0 for legacy rows never restocked.
   */
  purchasePrice?: number;
  /** Required storage condition (derived from category): cold / ambient / controlled. */
  storageCondition?: 'cold' | 'ambient' | 'controlled';
  supplierIds: string[];
  isActive: boolean;
  /**
   * SUM of all batch quantities for this medication (never stored, computed by
   * the server on GET /medications). `0` means out-of-stock — depleted lots are
   * deleted, so a fully-consumed medicine has no batches left to count.
   */
  totalStock?: number;
}

/** Best-effort Open FDA pre-fill for a scanned barcode (any field may be absent). */
export interface FdaPrefill {
  name?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
}

/** Payload to create a brand-new medication together with its first batch. */
export interface CreateMedicationWithBatchDto {
  barcode?: string;
  name: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  /** Catalog sale price for the new medication. */
  salePrice: number;
  /** Purchase (cost) price for the first batch. */
  purchasePrice: number;
  minStock: number;
  lotNumber: string;
  quantity: number;
  expiry: string;
  supplier?: string;
  storageId?: string;
  shelf?: string;
}

export interface CreateMedicationWithBatchResult {
  medication: Medication;
  batch: unknown;
  totalStock: number;
}

export const medicationService = {
  getAll: () => api.get<Medication[]>('/medications'),
  getByBarcode: (barcode: string) =>
    api.get<Medication>(`/medications/barcode/${encodeURIComponent(barcode)}`),
  /** Always resolves (200 `{}` when nothing maps) — never blocks the scan flow. */
  fdaLookup: (barcode: string) =>
    api.get<FdaPrefill>(`/medications/fda/${encodeURIComponent(barcode)}`),
  create: (data: Partial<Medication>) => api.post<Medication>('/medications', data),
  createWithBatch: (data: CreateMedicationWithBatchDto) =>
    api.post<CreateMedicationWithBatchResult>('/medications/with-batch', data),
  update: (id: string, data: Partial<Medication>) => api.put<Medication>(`/medications/${id}`, data),
  delete: (id: string) => api.delete(`/medications/${id}`),
};
