import React from 'react';
import type { TableHeader } from '../../../../core/components/Table';

export interface ParkingVisitorRow {
  visitor_id?: string | null;
  driver_name?: string;
  driver_telephone?: string;
  driver_email?: string;
  driver_gender?: string;
  driver_identification?: { id_type?: string; number?: string } | null;
  N_visits?: number;
}

export const VISITOR_COLUMNS: TableHeader[] = [
  { key: 'visitor_name', label: 'Full Name' },
  { key: 'visitor_id_type', label: 'ID Type' },
  { key: 'visitor_id_number', label: 'ID Number' },
  { key: 'visitor_telephone', label: 'Telephone' },
  { key: 'visitor_email', label: 'Email' },
  { key: 'visitor_gender', label: 'Gender' },
  { key: 'visitor_visits', label: 'Visits' },
];

const textOf = (value: unknown): string => (value === undefined || value === null || value === '' ? '-' : String(value));

export const visitorCell = (key: string, row: ParkingVisitorRow): React.ReactNode | undefined => {
  switch (key) {
    case 'visitor_name': return <span className="text-sm font-medium text-[#056daa]">{textOf(row.driver_name)}</span>;
    case 'visitor_id_type': return <span className="text-sm text-[#555555]">{textOf(row.driver_identification?.id_type)}</span>;
    case 'visitor_id_number': return <span className="text-sm font-mono text-[#333333]">{textOf(row.driver_identification?.number)}</span>;
    case 'visitor_telephone': return <span className="text-sm text-[#555555]">{textOf(row.driver_telephone)}</span>;
    case 'visitor_email': return <span className="text-sm text-[#555555]">{textOf(row.driver_email)}</span>;
    case 'visitor_gender': return <span className="text-sm text-[#555555]">{textOf(row.driver_gender)}</span>;
    case 'visitor_visits': return <span className="text-sm font-semibold text-[#333333]">{row.N_visits ?? 0}</span>;
    default: return undefined;
  }
};
