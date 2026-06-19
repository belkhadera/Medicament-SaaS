import { api } from './api';

export interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  barcode?: string;
  batch: string;
  stock: number;
  minStock: number;
  /** Sale price (catalog-level, from the medication). */
  salePrice: number;
  /** Purchase (cost) price for this specific lot. */
  purchasePrice: number;
  supplier?: string | null;
  receivedDate?: string | null;
  expiry: string;
  status: 'optimal' | 'low' | 'out' | 'expiring' | 'expired';
  location: string;
  storageId?: string | null;
  shelf?: string | null;
  medicationId?: string;
  /** SUM of all batch quantities for this medication (never-stored total). */
  medicationTotal?: number;
  /** Required storage condition of the medication (cold / ambient / controlled). */
  storageCondition?: 'cold' | 'ambient' | 'controlled';
}

export interface InventoryPage {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryPageParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InventoryItem['status'];
}

/** Payload for an audited inventory edit — `note` is the motif recorded in the ledger. */
export type InventoryUpdateDto = Partial<InventoryItem> & { note?: string };

/** Motif supplied when deleting content (logged to the ledger before removal). */
export interface DeleteMotifDto {
  reason?: 'expired' | 'damaged' | 'correction';
  note?: string;
}


export type MovementType = 'in' | 'out' | 'adjust';
export type MovementReason =
  | 'receipt' | 'scan_in' | 'dispense' | 'expired' | 'damaged' | 'correction';

export interface StockMovement {
  _id: string;
  itemId: string | Pick<InventoryItem, '_id' | 'name' | 'barcode' | 'location'>;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  balanceAfter: number;
  userId?: { _id: string; name: string; email: string } | string;
  note?: string;
  createdAt: string;
}

export interface StockInDto {
  itemId?: string;
  barcode?: string;
  quantity: number;
  reason?: 'scan_in' | 'receipt';
  note?: string;
}

export interface StockOutDto {
  itemId?: string;
  barcode?: string;
  quantity: number;
  reason?: 'dispense' | 'expired' | 'damaged';
  note?: string;
}

interface MovementResult {
  item: InventoryItem;
  movement: StockMovement | null;
}

/** FEFO dispense across a medication's linked lots (earliest expiry first). */
export interface DispenseDto {
  medicationId?: string;
  barcode?: string;
  quantity: number;
  reason?: 'dispense' | 'expired' | 'damaged';
  note?: string;
}

export interface DispenseResult {
  medicationId: string;
  medication: string;
  dispensed: number;
  reason: 'dispense' | 'expired' | 'damaged';
  remainingTotal: number;
  movements: { batchId: string; batchNumber: string; expiry: string; taken: number; balanceAfter: number }[];
}

export const inventoryService = {
  getAll: () => api.get<InventoryItem[]>('/inventory'),
  /** Server-paginated inventory list (returns items + pagination metadata). */
  getPage: (params: InventoryPageParams) => api.get<InventoryPage>('/inventory', { params }),
  getByBarcode: (barcode: string) =>
    api.get<InventoryItem>(`/inventory/barcode/${encodeURIComponent(barcode)}`),
  create: (data: Partial<InventoryItem>) => api.post<InventoryItem>('/inventory', data),
  update: (id: string, data: InventoryUpdateDto) => api.put<InventoryItem>(`/inventory/${id}`, data),
  delete: (id: string, motif?: DeleteMotifDto) => api.delete(`/inventory/${id}`, { data: motif }),

  // Stock movements (ledger).
  stockIn: (data: StockInDto) => api.post<MovementResult>('/inventory/stock-in', data),
  stockOut: (data: StockOutDto) => api.post<MovementResult>('/inventory/stock-out', data),
  /** FEFO withdrawal across all linked lots of a medication (earliest expiry first). */
  dispense: (data: DispenseDto) => api.post<DispenseResult>('/inventory/dispense', data),
  adjust: (data: { itemId: string; newStock: number; note?: string }) =>
    api.post<MovementResult>('/inventory/adjust', data),
  getMovements: (params?: { itemId?: string; type?: MovementType; reason?: MovementReason; from?: string; to?: string }) =>
    api.get<StockMovement[]>('/inventory/movements', { params }),
};
// Note: real API calls are used via `api`. If you need a local mock,
// implement a separate mock module or modify this file to return
// hard-coded data when the backend is not available.