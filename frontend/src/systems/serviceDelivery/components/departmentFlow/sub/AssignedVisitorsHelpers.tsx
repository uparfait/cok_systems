// Assigned Visitors Helpers - Types, status configs, and utility functions

export interface AssignedVisitor {
  id: string;
  fullName: string;
  nationalId: string;
  identity?: string;
  badgeNumber?: string;
  service: string;
  department: string;
  assignmentTime: string;
  status: string;
  phone: string;
  checkInTime: string;
  queuePosition?: number;
  checkedInTime?: string;
  checkedInGate?: string;
  receptionistName?: string;
  officerName?: string;
  providerName?: string;
  providerId?: string;
  serviceType?: string;
  currentDepartmentId?: string;
}

export const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  accepted: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "ACCEPTED" },
  completed: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", label: "COMPLETED" },
  transferred: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500", label: "TRANSFERRED" },
  inprogress: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", label: "IN PROGRESS" },
  waiting: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", label: "WAITING" },
  'not started': { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", label: "NOT STARTED" },
};

export const getDisplayStatus = (visitor: AssignedVisitor): string => {
  const serviceType = visitor.serviceType?.toLowerCase();
  if (serviceType === 'completed') return 'completed';
  if (serviceType === 'inprogress') return 'inprogress';
  if (serviceType === 'transfered') return 'transferred';
  if (visitor.status === 'transferred' || visitor.department) return 'waiting';
  return visitor.status?.toLowerCase() || 'waiting';
};

export const getOfficerName = (visitor: AssignedVisitor): string => {
  if (visitor.providerName) return visitor.providerName;
  if (visitor.officerName) return visitor.officerName;
  return 'Pending';
};

export const isOfficerAccepted = (visitor: AssignedVisitor): boolean => {
  const serviceType = visitor.serviceType?.toLowerCase();
  return serviceType === 'inprogress' || serviceType === 'accepted';
};

export const isServiceCompleted = (visitor: AssignedVisitor): boolean => {
  return visitor.serviceType?.toLowerCase() === 'completed';
};

export const getInitials = (name: string) => {
  if (!name) return "??";
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export const getColorFromName = (name: string) => {
  if (!name) return 'bg-gray-500';
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
  return colors[name.charCodeAt(0) % colors.length];
};