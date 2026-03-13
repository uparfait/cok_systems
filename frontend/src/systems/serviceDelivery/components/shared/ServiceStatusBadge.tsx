// ServiceStatusBadge Component - Reusable status badge for service delivery
// Supports different status types and styles used across all dashboards

import React from 'react';

// Export types for status values
export type ServiceStatus = 
  | 'pending' 
  | 'waiting' 
  | 'assigned'
  | 'In_progress' 
  | 'in_progress'
  | 'In-Progress'
  | 'completed' 
  | 'Completed'
  | 'transferred'
  | 'Transferred';

export interface ServiceStatusBadgeProps {
  status: string;
  variant?: 'receptionist' | 'manager' | 'employee';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// Receptionist Dashboard style (from getStatusBadge)
const receptionistStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-orange-100', text: 'text-orange-500', label: 'PENDING' },
  waiting: { bg: 'bg-green-400', text: 'text-green-700', label: 'ASSIGNED' },
  In_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'IN_PROGRESS' },
  in_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'IN_PROGRESS' },
  completed: { bg: 'bg-orange-300', text: 'text-white', label: 'COMPLETED' },
};

// Department Manager / Service Status style (from ServiceDetailsModal)
const managerStyles: Record<string, { bg: string; text: string; label: string }> = {
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  'In-Progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  In_Progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  Completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  Transferred: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Transferred' },
};

// Employee Dashboard style (from ProvideServicesTab)
const employeeStyles: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-[#e3f2fd]', text: 'text-[#1565c0]', label: 'Waiting' },
  'in-progress': { bg: 'bg-[#fff3e0]', text: 'text-[#e65100]', label: 'In Progress' },
  in_progress: { bg: 'bg-[#fff3e0]', text: 'text-[#e65100]', label: 'In Progress' },
  completed: { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', label: 'Completed' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
};

const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({ 
  status, 
  variant = 'receptionist',
  size = 'md',
  showLabel = true
}) => {
  // Normalize status for comparison (handle different formats)
  const normalizedStatus = status.toLowerCase().replace('-', '_').replace(' ', '_');
  
  // Get styles based on variant
  let styles = receptionistStyles;
  if (variant === 'manager') {
    styles = managerStyles;
  } else if (variant === 'employee') {
    styles = employeeStyles;
  }
  
  // Try to find matching style
  let style = styles[status] || styles[normalizedStatus] || styles[status.replace('_', '')];
  
  // Default fallback
  if (!style) {
    style = { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  }

  return (
    <span
      className={`
        inline-flex items-center justify-center font-medium rounded-full
        ${style.bg} ${style.text}
        ${sizeClasses[size]}
      `}
    >
      {showLabel && style.label}
    </span>
  );
};

// Helper function to get status info (for use in filtering/logic)
export const getStatusInfo = (status: string, variant: 'receptionist' | 'manager' | 'employee' = 'receptionist') => {
  let styles = receptionistStyles;
  if (variant === 'manager') styles = managerStyles;
  else if (variant === 'employee') styles = employeeStyles;
  
  const normalizedStatus = status.toLowerCase().replace('-', '_').replace(' ', '_');
  return styles[status] || styles[normalizedStatus] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
};

export default ServiceStatusBadge;
