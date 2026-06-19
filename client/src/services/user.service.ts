import { api } from './api';

export type UserRole =
  | 'Administrator'
  | 'Pharmacist'
  | 'Inventory Manager'
  | 'Pharmacy Tech'
  | 'Viewer';

export type UserStatus = 'active' | 'inactive';

/** A user account as returned by the admin endpoints (no credential fields). */
export interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  lastActive?: string;
  createdAt?: string;
}

/** Selectable roles, kept in sync with the server `User` schema enum. */
export const USER_ROLES: UserRole[] = [
  'Administrator',
  'Pharmacist',
  'Inventory Manager',
  'Pharmacy Tech',
  'Viewer',
];

/** French labels for roles (display only). */
export const ROLE_LABELS: Record<UserRole, string> = {
  Administrator: 'Administrateur',
  Pharmacist: 'Pharmacien',
  'Inventory Manager': 'Gestionnaire de stock',
  'Pharmacy Tech': 'Technicien en pharmacie',
  Viewer: 'Observateur',
};

/** Admin-only user management (server routes are guarded by the `admin` middleware). */
export const userService = {
  getAll: () => api.get<ManagedUser[]>('/auth/users'),
  update: (id: string, data: { name?: string; role?: UserRole; status?: UserStatus }) =>
    api.put<ManagedUser>(`/auth/users/${id}`, data),
};
