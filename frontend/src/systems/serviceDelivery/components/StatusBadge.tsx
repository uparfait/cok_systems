import React from 'react';

const fontHeading = "'Montserrat', sans-serif";

export type VisitorStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out' | 'on_leave' | 'cancelled';

interface StatusBadgeProps { status: VisitorStatus; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean; }

const statusColors: Record<VisitorStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]' }, assigned: { bg: 'bg-[rgba(5,109,170,0.08)]', text: 'text-[#056daa]' },
  in_service: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]' }, completed: { bg: 'bg-[#F0F0F0]', text: 'text-[#555555]' },
  checked_out: { bg: 'bg-[rgba(231,76,60,0.12)]', text: 'text-[#E74C3C]' }, on_leave: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#B9770E]' },
  cancelled: { bg: 'bg-[rgba(231,76,60,0.12)]', text: 'text-[#E74C3C]' },
};

const statusLabels: Record<VisitorStatus, string> = { pending: 'Pending', assigned: 'Assigned', in_service: 'In Service', completed: 'Completed', checked_out: 'Checked Out', on_leave: 'On Leave', cancelled: 'Cancelled' };
const sizeClasses = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm', lg: 'px-4 py-1.5 text-base' };

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showLabel = true }) => {
  const colors = statusColors[status] || statusColors.pending;
  return <span className={`inline-flex items-center justify-center font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]}`} style={{ fontFamily: fontHeading, borderRadius: 0 }}>{showLabel ? statusLabels[status] || status : <span className={`w-2 h-2 ${status === 'pending' ? 'bg-[#F39C12]' : status === 'assigned' ? 'bg-[#056daa]' : status === 'in_service' ? 'bg-[#4CAF50]' : status === 'completed' ? 'bg-[#9E9E9E]' : status === 'checked_out' ? 'bg-[#E74C3C]' : status === 'on_leave' ? 'bg-[#F39C12]' : 'bg-[#E74C3C]'}`} />}</span>;
};

export const StatusDot: React.FC<{ status: VisitorStatus; size?: 'sm' | 'md' | 'lg' }> = ({ status, size = 'md' }) => {
  const dotSizes = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  const dotColors: Record<VisitorStatus, string> = { pending: 'bg-[#F39C12]', assigned: 'bg-[#056daa]', in_service: 'bg-[#4CAF50]', completed: 'bg-[#9E9E9E]', checked_out: 'bg-[#E74C3C]', on_leave: 'bg-[#F39C12]', cancelled: 'bg-[#E74C3C]' };
  return <span className={`${dotSizes[size]} ${dotColors[status] || dotColors.pending}`} />;
};

export default StatusBadge;
