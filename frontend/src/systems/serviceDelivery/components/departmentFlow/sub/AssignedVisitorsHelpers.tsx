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
  accepted: { bg: "bg-[rgba(243,156,18,0.12)]", text: "text-[#F39C12]", dot: "bg-[#F39C12]", label: "ACCEPTED" },
  completed: { bg: "bg-[#F7F9FB]", text: "text-[#555555]", dot: "bg-[#9E9E9E]", label: "COMPLETED" },
  transferred: { bg: "bg-[rgba(41,128,185,0.1)]", text: "text-[#2980B9]", dot: "bg-[#2980B9]", label: "TRANSFERRED" },
  inprogress: { bg: "bg-[rgba(76,175,80,0.12)]", text: "text-[#388E3C]", dot: "bg-[#4CAF50]", label: "IN PROGRESS" },
  waiting: { bg: "bg-[rgba(5,109,170,0.1)]", text: "text-[#056daa]", dot: "bg-[#056daa]", label: "WAITING" },
  'not started': { bg: "bg-[rgba(5,109,170,0.1)]", text: "text-[#056daa]", dot: "bg-[#056daa]", label: "NOT STARTED" },
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
  if (!name) return 'bg-[#9E9E9E]';
  const colors = ['bg-[#E74C3C]', 'bg-[#056daa]', 'bg-[#4CAF50]', 'bg-[#F39C12]', 'bg-[#2980B9]', 'bg-[#CDB896]', 'bg-[#045d94]', 'bg-[#388E3C]'];
  return colors[name.charCodeAt(0) % colors.length];
};