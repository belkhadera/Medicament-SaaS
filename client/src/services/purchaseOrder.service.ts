import { api } from './api';
import type { Medication } from './medication.service';
import type { Supplier } from './supplier.service';

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  medicationId: string | Pick<Medication, '_id' | 'name' | 'category' | 'barcode' | 'salePrice' | 'defaultMinStock'>;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  /** Last known purchase price for this medication — pre-fills the delivery form. */
  lastPurchasePrice?: number;
}

export interface PurchaseOrder {
  _id: string;
  reference: string;
  orderId: string;
  supplierId: string | Pick<Supplier, '_id' | 'name' | 'contact' | 'phone' | 'status'>;
  lines: PurchaseOrderLine[];
  status: PurchaseOrderStatus;
  totalCost: number;
  orderedAt?: string;
  receivedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface CreatePOLine {
  medicationId: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiveLine {
  medicationId: string;
  batchNumber: string;
  expiry: string;
  location: string;
  receivedQuantity: number;
  /** Per-batch purchase (cost) price for this delivery. */
  purchasePrice: number;
  /** Structured storage destination (preferred over free-text location). */
  storageId?: string;
  shelf?: string;
}

/** One line confirmed on the scan-to-deliver flow. */
export interface DeliverItem {
  medicationId: string;
  receivedQuantity: number;
  lotNumber: string;
  expiry: string;
  location?: string;
  /** Structured storage destination (preferred over free-text location). */
  storageId?: string;
  shelf?: string;
  /** Per-batch purchase (cost) price for this delivery (editable, pre-filled). */
  purchasePrice: number;
}

export interface DeliverySummaryRow {
  medication: string;
  lotNumber: string;
  quantity: number;
  expiry: string;
}

export interface PurchaseOrderPage {
  items: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const purchaseOrderService = {
  getAll: (params?: { status?: PurchaseOrderStatus; supplierId?: string }) =>
    api.get<PurchaseOrder[]>('/purchase-orders', { params }),
  getPage: (params: { page?: number; limit?: number; status?: PurchaseOrderStatus }) =>
    api.get<PurchaseOrderPage>('/purchase-orders', { params }),
  getOne: (id: string) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
  getByOrderId: (orderId: string) =>
    api.get<PurchaseOrder>(`/purchase-orders/by-order-id/${encodeURIComponent(orderId)}`),
  create: (data: { supplierId: string; lines: CreatePOLine[] }) =>
    api.post<PurchaseOrder>('/purchase-orders', data),
  submit: (id: string) => api.patch<PurchaseOrder>(`/purchase-orders/${id}/submit`),
  receive: (id: string, lines: ReceiveLine[]) =>
    api.patch<PurchaseOrder>(`/purchase-orders/${id}/receive`, { lines }),
  deliver: (orderId: string, items: DeliverItem[]) =>
    api.patch<{ order: PurchaseOrder; summary: DeliverySummaryRow[] }>(
      `/purchase-orders/by-order-id/${encodeURIComponent(orderId)}/deliver`,
      { items },
    ),
  cancel: (id: string) => api.patch<PurchaseOrder>(`/purchase-orders/${id}/cancel`),
};
