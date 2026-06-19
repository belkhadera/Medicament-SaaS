import { api } from './api';
import { InventoryItem } from './inventory.service';

export type StorageType = 'cold' | 'ambient' | 'controlled' | 'quarantine' | 'general';

export interface Storage {
  _id: string;
  name: string;
  type: StorageType;
  shelves: string[];
  description?: string;
  minTemp?: number;
  maxTemp?: number;
}

export interface ShelfContents {
  name: string;
  items: InventoryItem[];
}

/** A storage unit with its content pre-grouped by shelf (as returned by GET /storages). */
export interface StorageWithContents {
  _id: string;
  name: string;
  type: StorageType;
  description?: string;
  minTemp?: number;
  maxTemp?: number;
  shelves: ShelfContents[];
  itemCount: number;
  totalUnits: number;
}

export interface StorageOverview {
  units: StorageWithContents[];
  unassigned: InventoryItem[];
}

export interface StorageDto {
  name: string;
  type: StorageType;
  shelves: string[] | string;
  description?: string;
  minTemp?: number | string;
  maxTemp?: number | string;
}

export const storageService = {
  getAll: () => api.get<StorageOverview>('/storages'),
  create: (data: StorageDto) => api.post<Storage>('/storages', data),
  update: (id: string, data: Partial<StorageDto>) => api.put<Storage>(`/storages/${id}`, data),
  delete: (id: string) => api.delete(`/storages/${id}`),
};
