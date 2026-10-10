export interface InHouseVisit {
  _id: string;
  visitor_id?: string | null;
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  identification?: { id_type?: string; number?: string } | null;
  N_visits?: number;
  vehicle_storage?: {
    has_vehicle?: boolean;
    parking_record?: string | null;
    vehicle_details?: { plate_number?: string; entered_time?: string; exited_time?: string; duration?: string };
  };
  entry_date?: string;
  is_still_inhouse?: boolean;
  marked_as_out?: boolean;
  current_duration?: string;
  is_over_limit?: boolean;
  badge_number?: string | null;
}

export type GateAction = 'checkout' | 'leave' | 'return';

export interface GateOutcome {
  id: string;
  removed: boolean;
}

export const hasVehicle = (row: InHouseVisit): boolean => !!row.vehicle_storage?.has_vehicle;

export const plateOf = (row: InHouseVisit): string => row.vehicle_storage?.vehicle_details?.plate_number || '';

export const actionFor = (row: InHouseVisit): GateAction => {
  if (!hasVehicle(row)) return 'checkout';
  return row.marked_as_out ? 'return' : 'leave';
};

export const ACTION_LABEL: Record<GateAction, string> = {
  checkout: 'Checkout',
  leave: 'Partial Exit',
  return: 'Returned',
};

export const ACTION_TITLE: Record<GateAction, string> = {
  checkout: 'Confirm Checkout',
  leave: 'Partial Exit',
  return: 'Return Visitor',
};

export const ACTION_SUCCESS: Record<GateAction, string> = {
  checkout: 'Visitor checked out',
  leave: 'Visitor marked as outside',
  return: 'Visitor marked as returned',
};

export const dash = (value?: string | number | null): string => {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};
