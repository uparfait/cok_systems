// Common types for Service Delivery System
// Centralized type definitions to avoid duplication

// ==================== Visitor Types ====================

export interface Visitor {
  id: string;
  full_name: string;
  identification: string;
  telephone: string;
  email?: string;
  address?: string;
  status: 'pending' | 'waiting' | 'In_progress' | 'completed';
  check_in_time: string;
  department?: string;
  service?: string;
  purpose?: string;
  assignedStaff?: string;
}

export interface VisitorManager {
  id: string;
  fullName: string;
  nationalId: string;
  service: string;
  department: string;
  arrivalTime: string;
  status: string;
  phone: string;
  requestId?: string;
}

// ==================== Employee Types ====================

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

// ==================== Service Status Types ====================

export interface ServiceStatusVisitor {
  id: string;
  requestId: string;
  fullName: string;
  initials: string;
  contact: string;
  service: string;
  status: 'Pending' | 'In-Progress' | 'Completed' | 'Transferred';
  assignedTo: string;
  assignedToInitials?: string;
  createdAt?: string;
}

// ==================== User Types ====================

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

// ==================== Service Record Types ====================

export interface ServiceRecord {
  id: string;
  visitorName: string;
  serviceId: string;
  status: 'pending' | 'completed' | 'transferred';
  assignmentTime: string;
  avatarColor: string;
  initials: string;
}

// ==================== Department Types ====================

export interface Department {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
}

// ==================== Status Badge Types ====================

export interface StatusBadgeStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
}

// ==================== Pagination Types ====================

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

// ==================== Notification Types ====================

export interface Notification {
  id: string;
  type: 'assignment' | 'status' | 'general';
  title: string;
  message: string;
  time: string;
  read: boolean;
}
