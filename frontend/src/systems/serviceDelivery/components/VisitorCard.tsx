// VisitorCard Component - Visitor information card
// Displays visitor details in a card format

import React from 'react';
import { 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiMapPin, 
  FiTruck, 
  FiCalendar,
  FiClock,
  FiEdit2,
  FiEye,
  FiMoreVertical
} from 'react-icons/fi';
import StatusBadge, { StatusDot } from './StatusBadge';
import ServiceTimer from './ServiceTimer';

export interface Visitor {
  _id: string;
  fullName: string;
  nationalId: string;
  phone: string;
  email?: string;
  address?: string;
  service: string;
  department?: {
    _id: string;
    department_name: string;
  };
  assignedEmployee?: {
    _id: string;
    fullName: string;
  };
  vehicleInfo?: {
    make: string;
    model: string;
    plateNumber: string;
    color: string;
  };
  checkInTime: string;
  expectedCheckoutTime?: string;
  status: 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out';
  notes?: string;
  purpose?: string;
}

interface VisitorCardProps {
  visitor: Visitor;
  onViewDetails?: (visitor: Visitor) => void;
  onEdit?: (visitor: Visitor) => void;
  onAssignEmployee?: (visitor: Visitor) => void;
  onCheckout?: (visitor: Visitor) => void;
  variant?: 'default' | 'compact' | 'detailed';
  showActions?: boolean;
}

const VisitorCard: React.FC<VisitorCardProps> = ({
  visitor,
  onViewDetails,
  onEdit,
  onAssignEmployee,
  onCheckout,
  variant = 'default',
  showActions = true,
}) => {
  // Format date/time
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Compact variant - minimal info
  if (variant === 'compact') {
    return (
      <div 
        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onViewDetails?.(visitor)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{visitor.fullName}</h3>
            <p className="text-sm text-gray-500 truncate">{visitor.service}</p>
          </div>
          <StatusDot status={visitor.status} size="sm" />
        </div>
        {visitor.department && (
          <p className="text-xs text-gray-500 mt-2">{visitor.department.department_name}</p>
        )}
      </div>
    );
  }

  // Detailed variant - all info
  if (variant === 'detailed') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">{visitor.fullName}</h3>
              <p className="text-blue-100 text-sm">{visitor.service}</p>
            </div>
            <StatusBadge status={visitor.status} size="lg" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Personal Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Personal Information</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FiUser className="text-gray-400" />
                  <span className="text-gray-900">{visitor.nationalId}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiPhone className="text-gray-400" />
                  <span className="text-gray-900">{visitor.phone}</span>
                </div>
                {visitor.email && (
                  <div className="flex items-center gap-3">
                    <FiMail className="text-gray-400" />
                    <span className="text-gray-900">{visitor.email}</span>
                  </div>
                )}
                {visitor.address && (
                  <div className="flex items-center gap-3">
                    <FiMapPin className="text-gray-400" />
                    <span className="text-gray-900">{visitor.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Visit Details</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FiCalendar className="text-gray-400" />
                  <span className="text-gray-900">{visitor.department?.department_name || 'Not Assigned'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiClock className="text-gray-400" />
                  <div>
                    <span className="text-gray-900">Check-in: </span>
                    <ServiceTimer checkInTime={visitor.checkInTime} variant="compact" />
                  </div>
                </div>
                {visitor.assignedEmployee && (
                  <div className="flex items-center gap-3">
                    <FiUser className="text-gray-400" />
                    <span className="text-gray-900">{visitor.assignedEmployee.fullName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          {visitor.vehicleInfo && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <FiTruck /> Vehicle Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Make</p>
                  <p className="font-medium">{visitor.vehicleInfo.make}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Model</p>
                  <p className="font-medium">{visitor.vehicleInfo.model}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Color</p>
                  <p className="font-medium">{visitor.vehicleInfo.color}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Plate Number</p>
                  <p className="font-medium">{visitor.vehicleInfo.plateNumber}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {visitor.notes && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{visitor.notes}</p>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <button
                onClick={() => onViewDetails?.(visitor)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiEye /> View Details
              </button>
              <button
                onClick={() => onEdit?.(visitor)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FiEdit2 /> Edit
              </button>
              {visitor.status === 'assigned' && (
                <button
                  onClick={() => onAssignEmployee?.(visitor)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FiUser /> Assign Employee
                </button>
              )}
              {(visitor.status === 'completed' || visitor.status === 'in_service') && (
                <button
                  onClick={() => onCheckout?.(visitor)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FiTruck /> Check Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant - balanced info
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-lg">
              {visitor.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{visitor.fullName}</h3>
            <p className="text-sm text-gray-500">{visitor.service}</p>
          </div>
        </div>
        <StatusBadge status={visitor.status} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <FiUser className="text-gray-400" />
          <span className="text-gray-600 truncate">{visitor.nationalId}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FiPhone className="text-gray-400" />
          <span className="text-gray-600">{visitor.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FiCalendar className="text-gray-400" />
          <span className="text-gray-600">{visitor.department?.department_name || 'N/A'}</span>
        </div>
        {visitor.vehicleInfo && (
          <div className="flex items-center gap-2 text-sm">
            <FiTruck className="text-gray-400" />
            <span className="text-gray-600">{visitor.vehicleInfo.plateNumber}</span>
          </div>
        )}
      </div>

      {/* Timer */}
      {visitor.status !== 'checked_out' && (
        <div className="flex items-center justify-between pt-3 border-t">
          <ServiceTimer checkInTime={visitor.checkInTime} variant="compact" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDetails?.(visitor)}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="View Details"
            >
              <FiEye />
            </button>
            {visitor.status === 'assigned' && (
              <button
                onClick={() => onAssignEmployee?.(visitor)}
                className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                title="Assign Employee"
              >
                <FiUser />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorCard;
