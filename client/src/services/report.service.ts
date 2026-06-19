import { api } from './api';

export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** One time bucket of the movement report (a day / week / month / year). */
export interface ReportBucket {
  key: string;
  label: string;
  unitsIn: number;
  unitsOut: number;
  valueIn: number;   // cost of goods received (purchasePrice × qty)
  valueOut: number;  // retail value dispensed (salePrice × qty)
  net: number;       // unitsIn − unitsOut
  movements: number;
}

/** Per-medication in/out totals across the whole report range. */
export interface ReportMedRow {
  name: string;
  category: string;
  unitsIn: number;
  unitsOut: number;
  net: number;
}

export interface MovementReport {
  granularity: Granularity;
  from: string;
  to: string;
  totals: {
    unitsIn: number;
    unitsOut: number;
    net: number;
    valueIn: number;
    valueOut: number;
    movements: number;
  };
  buckets: ReportBucket[];
  byMedication: ReportMedRow[];
}

export interface ReportParams {
  granularity: Granularity;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export const reportService = {
  movements: (params: ReportParams) =>
    api.get<MovementReport>('/reports/movements', { params }),
};
