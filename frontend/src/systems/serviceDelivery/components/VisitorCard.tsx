import React from 'react';
import { FiUser, FiPhone, FiMail, FiMapPin, FiTruck, FiCalendar, FiClock, FiEdit2, FiEye, FiMoreVertical } from 'react-icons/fi';
import StatusBadge, { StatusDot } from './StatusBadge';
import ServiceTimer from './ServiceTimer';

export interface Visitor { _id: string; fullName: string; nationalId: string; phone: string; email?: string; address?: string; service: string; department?: { _id: string; department_name: string }; assignedEmployee?: { _id: string; fullName: string }; vehicleInfo?: { make: string; model: string; plateNumber: string; color: string }; checkInTime: string; expectedCheckoutTime?: string; status: 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out'; notes?: string; purpose?: string; }

interface VisitorCardProps { visitor: Visitor; onViewDetails?: (v: Visitor) => void; onEdit?: (v: Visitor) => void; onAssignEmployee?: (v: Visitor) => void; onCheckout?: (v: Visitor) => void; variant?: 'default' | 'compact' | 'detailed'; showActions?: boolean; }

const VisitorCard: React.FC<VisitorCardProps> = ({ visitor, onViewDetails, onEdit, onAssignEmployee, onCheckout, variant = 'default', showActions = true }) => {
  const fmt = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (variant === 'compact') return (
    <div className="bg-white border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails?.(visitor)}>
      <div className="flex items-start justify-between"><div className="flex-1 min-w-0"><h3 className="text-sm font-medium text-gray-900 truncate">{visitor.fullName}</h3><p className="text-xs text-gray-500 truncate">{visitor.service}</p></div><StatusDot status={visitor.status} size="sm" /></div>
      {visitor.department && <p className="text-xs text-gray-500 mt-1">{visitor.department.department_name}</p>}
    </div>
  );

  if (variant === 'detailed') return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-white">{visitor.fullName}</h3><p className="text-blue-100 text-xs">{visitor.service}</p></div><StatusBadge status={visitor.status} size="lg" /></div></div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div><h4 className="text-xs font-medium text-gray-500 mb-2">Personal Information</h4><div className="space-y-2"><div className="flex items-center gap-2 text-sm"><FiUser className="text-gray-400 w-3.5 h-3.5" /><span>{visitor.nationalId}</span></div><div className="flex items-center gap-2 text-sm"><FiPhone className="text-gray-400 w-3.5 h-3.5" /><span>{visitor.phone}</span></div>{visitor.email && <div className="flex items-center gap-2 text-sm"><FiMail className="text-gray-400 w-3.5 h-3.5" /><span>{visitor.email}</span></div>}</div></div>
          <div><h4 className="text-xs font-medium text-gray-500 mb-2">Visit Details</h4><div className="space-y-2"><div className="flex items-center gap-2 text-sm"><FiCalendar className="text-gray-400 w-3.5 h-3.5" /><span>{visitor.department?.department_name || 'Not Assigned'}</span></div><div className="flex items-center gap-2 text-sm"><FiClock className="text-gray-400 w-3.5 h-3.5" /><span>Check-in: </span><ServiceTimer checkInTime={visitor.checkInTime} variant="compact" /></div></div></div>
        </div>
        {visitor.vehicleInfo && <div className="bg-gray-50 p-3 mb-4"><h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2"><FiTruck className="w-3.5 h-3.5" />Vehicle</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">{['Make', 'Model', 'Color', 'Plate'].map((l, i) => <div key={l}><p className="text-gray-500">{l}</p><p className="font-medium">{[visitor.vehicleInfo!.make, visitor.vehicleInfo!.model, visitor.vehicleInfo!.color, visitor.vehicleInfo!.plateNumber][i]}</p></div>)}</div></div>}
        {visitor.notes && <div className="mb-4"><h4 className="text-xs font-medium text-gray-500 mb-1">Notes</h4><p className="text-sm text-gray-700 bg-gray-50 p-2">{visitor.notes}</p></div>}
        {showActions && <div className="flex flex-wrap gap-2 pt-3 border-t"><button onClick={() => onViewDetails?.(visitor)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"><FiEye className="w-3.5 h-3.5" />View</button><button onClick={() => onEdit?.(visitor)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-xs font-medium hover:bg-gray-50"><FiEdit2 className="w-3.5 h-3.5" />Edit</button></div>}
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2"><div className="w-9 h-9 bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-semibold text-sm">{visitor.fullName.charAt(0).toUpperCase()}</span></div><div><h3 className="text-sm font-semibold text-gray-900">{visitor.fullName}</h3><p className="text-xs text-gray-500">{visitor.service}</p></div></div>
        <StatusBadge status={visitor.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">{visitor.nationalId && <div className="flex items-center gap-1.5"><FiUser className="text-gray-400 w-3 h-3" /><span className="truncate">{visitor.nationalId}</span></div>}<div className="flex items-center gap-1.5"><FiPhone className="text-gray-400 w-3 h-3" /><span>{visitor.phone}</span></div></div>
      {visitor.status !== 'checked_out' && <div className="flex items-center justify-between pt-2 border-t"><ServiceTimer checkInTime={visitor.checkInTime} variant="compact" /><div className="flex items-center gap-1"><button onClick={() => onViewDetails?.(visitor)} className="p-1.5 text-gray-400 hover:text-blue-600"><FiEye className="w-3.5 h-3.5" /></button></div></div>}
    </div>
  );
};

export default VisitorCard;