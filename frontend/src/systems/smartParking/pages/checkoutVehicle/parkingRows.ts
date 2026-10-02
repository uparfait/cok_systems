export interface ParkingIdentification {
  id_type?: string;
  number?: string;
}

export interface ParkingRow {
  _id?: string;
  plate_number: string;
  status?: string;
  driver_type?: string;
  slot_number?: string;
  check_in?: string | null;
  check_out?: string | null;
  duration?: string;
  is_flagged?: boolean;
  current_duration?: string;
  current_duration_hours?: number;
  is_over_limit?: boolean;
  driver_name?: string;
  driver_telephone?: string;
  driver_email?: string;
  badge_number?: string | null;
  driver_gender?: string;
  driver_identification?: ParkingIdentification | string | null;
  N_visits?: number;
  visitor_id?: string | null;
  visitor?: { _id?: string } | string | null;
}

export interface CheckoutViolation {
  allowed_minutes: number;
  total_minutes: number;
  overstayed_minutes: number;
}

export const rowKey = (row: ParkingRow): string => row._id || row.plate_number;

export const idTypeOf = (row: ParkingRow): string => {
  const id = row.driver_identification;
  if (!id || typeof id === 'string') return '-';
  return id.id_type || '-';
};

export const idNumberOf = (row: ParkingRow): string => {
  const id = row.driver_identification;
  if (!id) return '-';
  if (typeof id === 'string') return id || '-';
  return id.number || '-';
};

interface TypeStyle {
  label: string;
  background: string;
  color: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  staff: { label: 'Staff', background: 'rgba(5,109,170,0.1)', color: '#056daa' },
  regular: { label: 'Regular', background: 'rgba(41,128,185,0.1)', color: '#2980B9' },
  visitor: { label: 'Visitor', background: 'rgba(76,175,80,0.1)', color: '#4CAF50' },
};

export const driverTypeStyle = (type?: string | null): TypeStyle => {
  const key = String(type || 'visitor').trim().toLowerCase();
  return TYPE_STYLES[key] || { ...TYPE_STYLES.visitor, label: String(type) };
};

export const formatParkingDate = (value?: string | null, withYear = false): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(
    'en-US',
    withYear
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
      : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true },
  );
};

export const minutesText = (value?: number | null): string => {
  const total = Math.max(0, Math.round(Number(value) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${total} min (${hours}h ${minutes}m)`;
};
