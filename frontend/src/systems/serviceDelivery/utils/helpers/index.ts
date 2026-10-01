import type { ServiceStatusType, StatusBadgeStyle, VisitRow } from '../../types';

export const getInitials = (name?: string | null): string => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getColorFromName = (name?: string | null): string => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  ];
  const text = String(name || '').trim();
  if (!text) return colors[1];
  return colors[text.charCodeAt(0) % colors.length];
};

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: Date | string | null): string => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
};

export const formatTime = (value?: Date | string | null): string => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const SERVICE_STATUSES: ServiceStatusType[] = ['Not started', 'Inprogress', 'Transfered', 'Completed'];

const STATUS_ALIASES: Record<string, ServiceStatusType> = {
  'not started': 'Not started',
  notstarted: 'Not started',
  pending: 'Not started',
  waiting: 'Not started',
  inprogress: 'Inprogress',
  in_progress: 'Inprogress',
  'in-progress': 'Inprogress',
  'in progress': 'Inprogress',
  transfered: 'Transfered',
  transferred: 'Transfered',
  completed: 'Completed',
};

export const normalizeServiceStatus = (status?: string | null): ServiceStatusType | '' =>
  STATUS_ALIASES[String(status || '').trim().toLowerCase()] || '';

const SERVICE_STATUS_LABEL: Record<ServiceStatusType, string> = {
  'Not started': 'Waiting',
  Inprogress: 'Being served',
  Transfered: 'Transferred',
  Completed: 'Completed',
};

const SERVICE_STATUS_STYLE: Record<ServiceStatusType, Omit<StatusBadgeStyle, 'label'>> = {
  'Not started': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  Inprogress: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  Transfered: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
  Completed: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
};

const NEUTRAL_STYLE: Omit<StatusBadgeStyle, 'label'> = { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-800' };

export const serviceStatusLabel = (status?: string | null): string => {
  const normalized = normalizeServiceStatus(status);
  return normalized ? SERVICE_STATUS_LABEL[normalized] : status || '-';
};

export const getServiceStatusBadge = (status?: string | null): StatusBadgeStyle => {
  const normalized = normalizeServiceStatus(status);
  if (!normalized) return { ...NEUTRAL_STYLE, label: status || '-' };
  return { ...SERVICE_STATUS_STYLE[normalized], label: SERVICE_STATUS_LABEL[normalized] };
};

export const currentServiceStatus = (
  row: Partial<Pick<VisitRow, 'services_status' | 'is_being_served'>>
): ServiceStatusType | '' => {
  if (row.is_being_served) return 'Inprogress';
  const latest = (row.services_status || [])[0];
  return latest ? normalizeServiceStatus(latest.s_type) : '';
};

export const getVisitorStatusBadge = (
  row: Partial<Pick<VisitRow, 'services_status' | 'is_being_served'>>
): StatusBadgeStyle => {
  const status = currentServiceStatus(row);
  if (!status) return { ...NEUTRAL_STYLE, label: 'Not sent yet' };
  return getServiceStatusBadge(status);
};

export const getPresenceBadge = (
  row: Partial<Pick<VisitRow, 'is_still_inhouse' | 'marked_as_out'>>
): StatusBadgeStyle => {
  if (!row.is_still_inhouse) return { ...NEUTRAL_STYLE, label: 'Left' };
  if (row.marked_as_out) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'Stepped out' };
  return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'In house' };
};

export const servedByLabel = (row: Partial<Pick<VisitRow, 'serving_by'>>): string => {
  const server = row.serving_by;
  if (!server || !server.name) return '-';
  const department = server.department_name ? ` (${server.department_name})` : '';
  const since = server.started_at ? ` since ${formatTime(server.started_at)}` : '';
  return `${server.name}${department}${since}`;
};

export const getEmployeeStatusBadge = (status: string) => {
  switch (status) {
    case 'Active':
    case 'available':
      return { bg: 'bg-green-100', text: 'text-green-600', label: 'Active' };
    case 'Away':
    case 'busy':
      return { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Away' };
    case 'off':
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Off' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
};

export const filterVisitorsBySearch = <T extends Partial<Pick<VisitRow, 'full_name' | 'telephone' | 'email' | 'identification'>>>(
  visitors: T[],
  searchTerm: string
): T[] => {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return visitors;
  return visitors.filter((visitor) =>
    [visitor.full_name, visitor.identification?.number, visitor.telephone, visitor.email]
      .some((value) => String(value || '').toLowerCase().includes(term))
  );
};

export const calculatePagination = (totalItems: number, currentPage: number, itemsPerPage: number) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return {
    totalPages,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

export const getPaginatedItems = <T,>(items: T[], currentPage: number, itemsPerPage: number): T[] => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return items.slice(startIndex, startIndex + itemsPerPage);
};

export const countByStatus = <T extends { status: string }>(items: T[], status: string): number =>
  items.filter((item) => item.status === status).length;
