// StatusBadge Component - Visitor status indicator
// Displays colored badge showing visitor service status

import React from 'react';

export type VisitorStatus = 
  | 'pending' 
  | 'assigned' 
  | 'in_service' 
  | 'completed' 
  | 'checked_out'
  | 'on_leave'
  | 'cancelled';

interface StatusBadgeProps {
  status: VisitorStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// Status color mapping
const statusColors: Record<VisitorStatus, { bg: string; text: string; border?: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  assigned: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  in_service: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  checked_out: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  on_leave: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
};

// Status label mapping
const statusLabels: Record<VisitorStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_service: 'In Service',
  completed: 'Completed',
  checked_out: 'Checked Out',
  on_leave: 'On Leave',
  cancelled: 'Cancelled',
};

// Size classes
const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md',
  showLabel = true 
}) => {
  const colors = statusColors[status] || statusColors.pending;
  const label = statusLabels[status] || status;

  return (
    <span
      className={`
        inline-flex items-center justify-center font-medium rounded-full
        ${colors.bg} ${colors.text}
        ${sizeClasses[size]}
      `}
    >
      {showLabel && label}
      {!showLabel && (
        <span 
          className={`
            w-2 h-2 rounded-full mr-1.5
            ${status === 'pending' ? 'bg-yellow-500' : 
              status === 'assigned' ? 'bg-blue-500' : 
              status === 'in_service' ? 'bg-green-500' : 
              status === 'completed' ? 'bg-gray-500' : 
              status === 'checked_out' ? 'bg-red-500' : 
              status === 'on_leave' ? 'bg-orange-500' : 'bg-red-400'}
          `}
        />
      )}
    </span>
  );
};

// Status indicator dot (for inline use)
export const StatusDot: React.FC<{ status: VisitorStatus; size?: 'sm' | 'md' | 'lg' }> = ({ 
  status,
  size = 'md'
}) => {
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const dotColors: Record<VisitorStatus, string> = {
    pending: 'bg-yellow-500',
    assigned: 'bg-blue-500',
    in_service: 'bg-green-500',
    completed: 'bg-gray-500',
    checked_out: 'bg-red-500',
    on_leave: 'bg-orange-500',
    cancelled: 'bg-red-400',
  };

  return (
    <span 
      className={`${dotSizes[size]} rounded-full ${dotColors[status] || dotColors.pending}`}
    />
  );
};

export default StatusBadge;
