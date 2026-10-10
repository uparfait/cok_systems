export const ID_TYPES = ['National ID', 'Passport', 'Driving Licence'];
export const GENDERS = ['Male', 'Female'];

export interface VisitorIdentification {
  id_type: string;
  number: string;
}

export interface Visitor {
  _id: string;
  identification: VisitorIdentification;
  full_name: string;
  telephone: string;
  email: string;
  gender: string;
  Is_In_House: boolean;
  N_visits: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ServingBy {
  user_id?: string | null;
  name?: string;
  email?: string;
  department_id?: string | null;
  department_name?: string;
  started_at?: string | null;
}

export interface VisitorRowVisit {
  _id: string;
  entry_date: string;
  department_name: string;
  provider_name: string;
  status: string;
  is_being_served: boolean;
  serving_by: ServingBy | null;
  has_vehicle: boolean;
  plate_number: string;
  marked_as_out: boolean;
  attachments_count: number;
}

export interface VisitorRow extends Visitor {
  current_visit: VisitorRowVisit | null;
}

export interface DepartmentAssignment {
  _id?: string;
  department_id: string;
  department_name: string;
  assigned_time?: string;
  reached_in?: boolean;
  provider_name?: string;
  provider_id?: string | null;
  assigned_by?: { user_id?: string; name?: string; email?: string };
}

export interface ServiceStatusEntry {
  _id?: string;
  department_id: string;
  department_name: string;
  provider_name?: string;
  provider_id?: string | null;
  s_type: string;
}

export interface ServiceDuration {
  department_id?: string;
  department_name?: string;
  duration?: string | null;
  started_at?: string;
  ended_at?: string | null;
  provider_name?: string;
  provider_id?: string;
}

export interface VisitNote {
  writter_name?: string;
  message?: string;
  timestamp?: string;
}

export interface Visit {
  _id: string;
  visitor: Visitor | null;
  visitor_id: string | null;
  entry_date: string;
  exist_date: string | null;
  is_still_inhouse: boolean;
  marked_as_out: boolean;
  badge_number?: string | null;
  is_being_served: boolean;
  serving_by: ServingBy | null;
  registered_by?: string;
  vehicle_storage?: {
    has_vehicle?: boolean;
    parking_record?: string | null;
    vehicle_details?: { plate_number?: string; entered_time?: string; exited_time?: string; duration?: string };
  };
  departments_assigned: DepartmentAssignment[];
  services_status: ServiceStatusEntry[];
  durations?: { services_durations?: ServiceDuration[]; entry_and_leave_duration?: string };
  notes?: VisitNote[];
  attachments_count?: number;
}

export interface VisitorPermissions {
  role_slug: string;
  can_edit: boolean;
  can_serve: boolean;
  can_complete: boolean;
  can_transfer: boolean;
  can_send: boolean;
  can_add_attachment: boolean;
  serving_by: ServingBy | null;
}

export interface VisitorDetails {
  visitor: Visitor;
  current_visit: Visit | null;
  last_visit: Visit | null;
  visits_total: number;
  permissions: VisitorPermissions;
}

export interface VisitorAttachment {
  _id: string;
  description: string;
  file_name: string;
  mime_type: string;
  size: number;
  uploaded_by: {
    user_id?: string;
    name?: string;
    email?: string;
    telephone?: string;
    department_id?: string;
    department_name?: string;
  };
  uploaded_at: string;
  updated_at: string | null;
  can_edit: boolean;
  visit: { _id: string; entry_date: string; is_still_inhouse: boolean } | null;
}

export interface VisitorInput {
  visitor_id?: string | null;
  full_name: string;
  telephone: string;
  email: string;
  gender: string;
  identification: VisitorIdentification;
}

export type UniqueField = 'identification' | 'telephone' | 'email';

export interface VisitorLookupResult {
  visitor: Visitor | null;
  matches: { field: UniqueField; visitor: Visitor }[];
  conflict: boolean;
}

export interface DepartmentTarget {
  department_id: string;
  department_name: string;
  provider_id?: string | null;
  provider_name?: string | null;
}

export interface VisitorListParams {
  page?: number;
  limit?: number;
  presence?: 'in_house' | 'not_in_house' | 'all';
  from?: string;
  to?: string;
  full_name?: string;
  id_type?: string;
  id_number?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  n_visits?: string;
  n_visits_mode?: string;
  scope?: 'mine' | '';
  sort?: string;
  dir?: 'asc' | 'desc';
}

export const emptyVisitorInput = (): VisitorInput => ({
  visitor_id: null,
  full_name: '',
  telephone: '',
  email: '',
  gender: '',
  identification: { id_type: 'National ID', number: '' },
});

export const visitorToInput = (visitor: Visitor): VisitorInput => ({
  visitor_id: visitor._id,
  full_name: visitor.full_name || '',
  telephone: visitor.telephone || '',
  email: visitor.email || '',
  gender: visitor.gender || '',
  identification: {
    id_type: visitor.identification?.id_type || 'National ID',
    number: visitor.identification?.number || '',
  },
});
