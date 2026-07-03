import React from 'react';

export type VisitorStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out' | 'on_leave' | 'cancelled';

interface StatusBadgeProps { status: VisitorStatus; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean; }

const statusColors: Record<VisitorStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' }, assigned: { bg: 'bg-blue-100', text: 'text-blue-800' },
  in_service: { bg: 'bg-green-100', text: 'text-green-800' }, completed: { bg: 'bg-gray-100', text: 'text-gray-800' },
  checked_out: { bg: 'bg-red-100', text: 'text-red-800' }, on_leave: { bg: 'bg-orange-100', text: 'text-orange-800' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600' },
};

const statusLabels: Record<VisitorStatus, string> = { pending: 'Pending', assigned: 'Assigned', in_service: 'In Service', completed: 'Completed', checked_out: 'Checked Out', on_leave: 'On Leave', cancelled: 'Cancelled' };
const sizeClasses = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm', lg: 'px-4 py-1.5 text-base' };

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showLabel = true }) => {
  const colors = statusColors[status] || statusColors.pending;
  return <span className={`inline-flex items-center justify-center font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]}`}>{showLabel ? statusLabels[status] || status : <span className={`w-2 h-2 ${status === 'pending' ? 'bg-yellow-500' : status === 'assigned' ? 'bg-blue-500' : status === 'in_service' ? 'bg-green-500' : status === 'completed' ? 'bg-gray-500' : status === 'checked_out' ? 'bg-red-500' : status === 'on_leave' ? 'bg-orange-500' : 'bg-red-400'}`} />}</span>;
};

export const StatusDot: React.FC<{ status: VisitorStatus; size?: 'sm' | 'md' | 'lg' }> = ({ status, size = 'md' }) => {
  const dotSizes = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  const dotColors: Record<VisitorStatus, string> = { pending: 'bg-yellow-500', assigned: 'bg-blue-500', in_service: 'bg-green-500', completed: 'bg-gray-500', checked_out: 'bg-red-500', on_leave: 'bg-orange-500', cancelled: 'bg-red-400' };
  return <span className={`${dotSizes[size]} ${dotColors[status] || dotColors.pending}`} />;
};

export default StatusBadge;