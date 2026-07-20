// ServiceStatusBadge Component - Reusable status badge for service delivery
// Supports different status types and styles used across all dashboards

import React from 'react';

const fontHeading = "'Montserrat', sans-serif";

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
  pending: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]', label: 'PENDING' },
  waiting: { bg: 'bg-[rgba(5,109,170,0.08)]', text: 'text-[#056daa]', label: 'ASSIGNED' },
  In_progress: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]', label: 'IN_PROGRESS' },
  in_progress: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]', label: 'IN_PROGRESS' },
  completed: { bg: 'bg-[#F0F0F0]', text: 'text-[#555555]', label: 'COMPLETED' },
};

// Department Manager / Service Status style (from ServiceDetailsModal)
const managerStyles: Record<string, { bg: string; text: string; label: string }> = {
  Pending: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]', label: 'Pending' },
  'In-Progress': { bg: 'bg-[rgba(5,109,170,0.08)]', text: 'text-[#056daa]', label: 'In Progress' },
  In_Progress: { bg: 'bg-[rgba(5,109,170,0.08)]', text: 'text-[#056daa]', label: 'In Progress' },
  Completed: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]', label: 'Completed' },
  Transferred: { bg: 'bg-[rgba(41,128,185,0.12)]', text: 'text-[#2980B9]', label: 'Transferred' },
};

// Employee Dashboard style (from ProvideServicesTab)
const employeeStyles: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-[rgba(5,109,170,0.08)]', text: 'text-[#056daa]', label: 'Waiting' },
  'in-progress': { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]', label: 'In Progress' },
  in_progress: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]', label: 'In Progress' },
  completed: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]', label: 'Completed' },
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
    style = { bg: 'bg-[#F0F0F0]', text: 'text-[#555555]', label: status };
  }

  return (
    <span
      className={`
        inline-flex items-center justify-center font-medium
        ${style.bg} ${style.text}
        ${sizeClasses[size]}
      `}
      style={{ fontFamily: fontHeading, borderRadius: 0 }}
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
  return styles[status] || styles[normalizedStatus] || { bg: 'bg-[#F0F0F0]', text: 'text-[#555555]', label: status };
};

export default ServiceStatusBadge;
