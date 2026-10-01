import type { Visitor, VisitorInput } from '../../../../core/components/visitor/visitorTypes';
import { ID_TYPES, emptyVisitorInput, visitorToInput } from '../../../../core/components/visitor/visitorTypes';

export interface DriverPrefill {
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  identification?: { id_type?: string; number?: string } | null;
}

export interface ParkingDetails {
  _id?: string;
  plate_number?: string;
  check_in?: string | null;
  slot_number?: string;
  driver_type?: string;
  driver_name?: string;
  driver_telephone?: string;
  visitor_id?: string | null;
  visitor?: Visitor | null;
  N_visits?: number;
  is_flagged?: boolean;
}

export interface StaffDetails {
  owner_name?: string;
  owner_title?: string;
  department_name?: string;
  valid_until?: string | null;
}

export interface ReservationDetails {
  driver_name?: string;
  slot_number?: string;
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface VerifyData {
  plate_number: string;
  is_currently_parked: boolean;
  parking_details: ParkingDetails | null;
  vehicle_category: string;
  driver_type?: string;
  is_flagged: boolean;
  was_ever_flagged: boolean;
  is_reserved: boolean;
  staff_details: StaffDetails | null;
  emergency_reservation_details: ReservationDetails | null;
  last_driver: Visitor | null;
  visitor_id: string | null;
  driver: DriverPrefill | null;
}

export interface VerifyResult {
  found: boolean;
  data: VerifyData;
}

export interface PastFlagInfo {
  count: number;
  flagged_at: string | null;
  check_in: string | null;
  check_out: string | null;
  total_duration_minutes: number | null;
  overstay_minutes: number | null;
  flag_reason: string;
}

export const DEFAULT_FLAG_REASON = 'Exceeded allowed parking duration';

export const cleanPlate = (value: string): string => (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const formatMinutes = (mins: number | null | undefined): string => {
  if (mins === null || mins === undefined) return '-';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const minutesSince = (value?: string | null): number | null => {
  if (!value) return null;
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.round((Date.now() - start) / 60000));
};

export const formatFlagDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const formatFlagTime = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const ID_ALIASES: Record<string, string> = {
  nid: 'National ID',
  'national id': 'National ID',
  passport: 'Passport',
  'driving licence': 'Driving Licence',
  'driving license': 'Driving Licence',
  'driving permit': 'Driving Licence',
};

const normalizeIdType = (value?: string): string => {
  const text = (value || '').trim();
  if (ID_TYPES.includes(text)) return text;
  return ID_ALIASES[text.toLowerCase()] || 'National ID';
};

const normalizeGender = (value?: string): string => {
  const text = (value || '').trim().toLowerCase();
  if (text === 'male' || text === 'm') return 'Male';
  if (text === 'female' || text === 'f') return 'Female';
  return '';
};

export type PrefillSource = 'last_driver' | 'reservation' | 'staff' | 'none';

export const prefillSourceOf = (data: VerifyData | null): PrefillSource => {
  if (data?.last_driver?._id) return 'last_driver';
  if (!data?.driver) return 'none';
  if (data.emergency_reservation_details) return 'reservation';
  if (data.staff_details) return 'staff';
  return 'none';
};

export const prefillFromVerify = (data: VerifyData | null): VisitorInput => {
  if (data?.last_driver?._id) return visitorToInput(data.last_driver);
  const driver = data?.driver;
  if (!driver) return emptyVisitorInput();
  return {
    visitor_id: null,
    full_name: driver.full_name || '',
    telephone: driver.telephone || '',
    email: driver.email || '',
    gender: normalizeGender(driver.gender),
    identification: {
      id_type: normalizeIdType(driver.identification?.id_type),
      number: driver.identification?.number || '',
    },
  };
};

export const categoryText = (data: VerifyData): string => {
  const category = data.vehicle_category || 'Regular';
  if (category === 'Staff') return 'Staff vehicle';
  if (category === 'Visitor') return 'Reserved visitor vehicle';
  return 'Regular vehicle';
};
