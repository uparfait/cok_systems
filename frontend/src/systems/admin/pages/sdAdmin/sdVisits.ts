import { useEffect, useRef } from 'react';
import { useSocket } from '../../../../core/contexts/SocketContext';

export interface SdVisit {
  _id: string;
  visitor_id?: string | null;
  visitor?: { _id?: string | null } | null;
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  N_visits?: number;
  identification?: { id_type?: string; number?: string };
  departments_assigned?: Array<{ department_id?: string; department_name?: string; assigned_time?: string; reached_in?: boolean; provider_name?: string; provider_id?: string }>;
  services_status?: Array<{ department_name?: string; department_id?: string; provider_name?: string; provider_id?: string; s_type?: string }>;
  serving_by?: { name?: string; department_name?: string; started_at?: string | null } | null;
  vehicle_storage?: { has_vehicle?: boolean; vehicle_details?: { plate_number?: string } };
  entry_date?: string;
  exist_date?: string;
  is_still_inhouse?: boolean;
  marked_as_out?: boolean;
  current_duration?: string;
}

export interface VisitorFigures {
  registered_visitors?: number;
  visitors_in_house?: number;
  returning_visitors?: number;
  unique_visitors?: number;
}

export const VISITOR_HEADERS = ['Full Name', 'ID Type', 'ID Number', 'Telephone', 'Email', 'Gender', 'Visits'];

export const VISITOR_EVENTS = ['visitor_checkedin', 'visitor_checkedout', 'visitor_updated'];

export const initialsOf = (name: string) => (name || '?').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

export const visitorValues = (v: SdVisit, empty = '-'): string[] => [
  v.full_name || empty,
  v.identification?.id_type || empty,
  v.identification?.number || empty,
  v.telephone || empty,
  v.email || empty,
  v.gender || empty,
  String(v.N_visits ?? 0),
];

export const matchesVisitorText = (v: SdVisit, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [v.full_name, v.telephone, v.email, v.identification?.number, v.vehicle_storage?.vehicle_details?.plate_number]
    .some((value) => String(value || '').toLowerCase().includes(q));
};

const numberOr = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

export const figuresOf = (source: unknown): VisitorFigures => {
  const s = (source || {}) as Record<string, unknown>;
  return {
    registered_visitors: numberOr(s.registered_visitors),
    visitors_in_house: numberOr(s.visitors_in_house),
    returning_visitors: numberOr(s.returning_visitors),
    unique_visitors: numberOr(s.unique_visitors),
  };
};

export async function fetchAllPages<T extends { _id?: string }>(fetchPage: (page: number) => Promise<any>, maxPages = 20): Promise<T[]> {
  const first = await fetchPage(1);
  const firstRows: T[] = Array.isArray(first?.data) ? first.data : [];
  const total = Number(first?.total) || 0;
  const pageCount = Number(first?.pages) || (firstRows.length ? Math.ceil(total / firstRows.length) : 1);
  const pages = Math.min(maxPages, Math.max(1, pageCount));
  const byId = new Map<string, T>();
  const extra: T[] = [];
  const add = (rows: T[]) => rows.forEach((row) => { if (row?._id) byId.set(String(row._id), row); else extra.push(row); });
  add(firstRows);
  for (let start = 2; start <= pages; start += 5) {
    const batch: Promise<any>[] = [];
    for (let p = start; p <= Math.min(pages, start + 4); p += 1) batch.push(fetchPage(p));
    const results = await Promise.all(batch);
    results.forEach((r) => add(Array.isArray(r?.data) ? r.data : []));
  }
  return [...byId.values(), ...extra];
}

export async function loadReportBanner(): Promise<string | null> {
  try {
    const res = await fetch('/LOGO_COK_report.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export const BANNER_RATIO = 221 / 1116;

export function useVisitorEvents(onChange: () => void, enabled = true) {
  const { socket, isConnected } = useSocket();
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!socket || !isConnected || !enabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), 800);
    };
    VISITOR_EVENTS.forEach((event) => socket.on(event, handler));
    return () => {
      if (timer) clearTimeout(timer);
      VISITOR_EVENTS.forEach((event) => socket.off(event, handler));
    };
  }, [socket, isConnected, enabled]);
}
