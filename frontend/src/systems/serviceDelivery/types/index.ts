import type {
  DepartmentAssignment,
  ServiceDuration,
  ServiceStatusEntry,
  ServingBy,
  Visitor,
  VisitorIdentification,
  VisitNote,
} from '../../../core/components/visitor/visitorTypes';

export type { DepartmentAssignment, ServiceDuration, ServingBy, Visitor, VisitorIdentification, VisitNote };

export type ServiceStatusType = 'Not started' | 'Inprogress' | 'Transfered' | 'Completed';

export interface VisitServiceStatus extends Omit<ServiceStatusEntry, 's_type'> {
  s_type: ServiceStatusType;
}

export interface VehicleDetails {
  plate_number?: string;
  entered_time?: string | null;
  exited_time?: string | null;
  duration?: string | null;
}

export interface VehicleStorage {
  has_vehicle?: boolean;
  parking_record?: string | null;
  vehicle_details?: VehicleDetails;
}

export interface EmergencyDuration {
  type_of_emergency?: 'Leave outside' | 'Other';
  duration?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  provider_name?: string;
  provider_id?: string;
}

export interface VisitDurations {
  services_durations?: ServiceDuration[];
  entry_and_leave_duration?: string | null;
  emergency_durations?: EmergencyDuration[];
}

export interface VisitItem {
  item_name?: string;
  quantity?: number;
  description?: string;
}

export interface VisitRow {
  _id: string;
  visitor_id: string | null;
  visitor: Visitor | null;
  full_name: string;
  telephone: string;
  email: string;
  gender: string;
  identification: VisitorIdentification;
  N_visits: number;
  Is_In_House: boolean;
  serving_by: ServingBy | null;
  entry_date: string;
  exist_date: string | null;
  is_still_inhouse: boolean;
  is_being_served: boolean;
  marked_as_out: boolean;
  registered_by?: string;
  vehicle_storage?: VehicleStorage;
  departments_assigned: DepartmentAssignment[];
  services_status: VisitServiceStatus[];
  durations?: VisitDurations;
  items_entered_with?: VisitItem[];
  items_exited_with?: VisitItem[];
  notes?: VisitNote[];
  attachments_count?: number;
  current_duration?: string;
  current_duration_hours?: number;
  is_near_limit?: boolean;
  is_over_limit?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface VisitListResponse {
  success: boolean;
  type?: string;
  message?: string;
  total: number;
  page: number;
  limit?: number;
  pages?: number;
  data: VisitRow[];
}

export interface ServiceRecord {
  visit_id: string;
  visitor_id: string | null;
  full_name: string;
  department_id: string;
  department_name: string;
  provider_name: string;
  status: ServiceStatusType;
  assigned_time: string | null;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'available' | 'busy' | 'off';
  avatar?: string;
}

export interface DepartmentEmployee {
  id: string;
  empId: string;
  name: string;
  email: string;
  title: string;
  status: 'Active' | 'Away';
  initials: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
}

export interface CurrentUser {
  firstName: string;
  lastName: string;
  role: string;
  avatar: string | null;
}

export interface Department {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
}

export interface StatusBadgeStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface Notification {
  id: string;
  type: 'assignment' | 'status' | 'general';
  title: string;
  message: string;
  time: string;
  read: boolean;
}
