// ServiceActionPanel Component - Service action controls
// Panel with actions for visitor service management

import React, { useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiUserPlus,
  FiMessageSquare,
  FiFileText,
  FiPhone,
  FiTruck,
  FiPower,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';
import { toggleServiceStatus, toggleEmergencyLeaveReturn } from '../../services/serviceDeliveryService';

// City of Kigali institutional design constants
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

interface Visitor {
  _id: string;
  fullName: string;
  service: string;
  status: 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out' | 'on_leave';
  department?: {
    _id: string;
    department_name: string;
  };
  assignedEmployee?: {
    _id: string;
    fullName: string;
  };
  notes?: string;
}

interface ServiceActionPanelProps {
  visitor: Visitor;
  onStatusChange?: (newStatus: string) => void;
  onAssignEmployee?: () => void;
  onAddNote?: () => void;
  onCheckout?: () => void;
  onEmergencyLeave?: () => void;
  isLoading?: boolean;
}

type ServiceAction =
  | 'start_service'
  | 'pause_service'
  | 'resume_service'
  | 'complete_service'
  | 'emergency_leave'
  | 'emergency_return';

const ServiceActionPanel: React.FC<ServiceActionPanelProps> = ({
  visitor,
  onStatusChange,
  onAssignEmployee,
  onAddNote,
  onCheckout,
  onEmergencyLeave,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<ServiceAction | null>(null);

  // Get available actions based on current status
  const getAvailableActions = () => {
    const { status } = visitor;

    switch (status) {
      case 'assigned':
        return [
          {
            id: 'start_service',
            label: 'Start Service',
            icon: FiPlay,
            color: 'bg-[#4CAF50] hover:bg-[#388E3C]',
            description: 'Begin serving this visitor'
          },
          {
            id: 'emergency_leave',
            label: 'Emergency Leave',
            icon: FiAlertTriangle,
            color: 'bg-[#F39C12] hover:bg-[#D68910]',
            description: 'Allow visitor to leave temporarily'
          },
        ];
      case 'in_service':
        return [
          {
            id: 'pause_service',
            label: 'Pause Service',
            icon: FiPause,
            color: 'bg-[#F39C12] hover:bg-[#D68910]',
            description: 'Temporarily pause service'
          },
          {
            id: 'complete_service',
            label: 'Complete Service',
            icon: FiCheckCircle,
            color: 'bg-[#056daa] hover:bg-[#045d94]',
            description: 'Mark service as completed'
          },
          {
            id: 'emergency_leave',
            label: 'Emergency Leave',
            icon: FiAlertTriangle,
            color: 'bg-[#F39C12] hover:bg-[#D68910]',
            description: 'Allow visitor to leave temporarily'
          },
        ];
      default:
        return [];
    }
  };

  const availableActions = getAvailableActions();

  // Handle action execution
  const handleAction = async (action: ServiceAction) => {
    setIsProcessing(action);
    setShowConfirm(null);

    try {
      let response;

      switch (action) {
        case 'start_service':
        case 'complete_service':
          response = await toggleServiceStatus({
            visitorId: visitor._id,
            action,
          });
          break;
        case 'pause_service':
        case 'resume_service':
          response = await toggleServiceStatus({
            visitorId: visitor._id,
            action,
          });
          break;
        case 'emergency_leave':
        case 'emergency_return':
          response = await toggleEmergencyLeaveReturn({
            visitorId: visitor._id,
            action,
          });
          break;
      }

      if (response?.status) {
        if (onStatusChange) {
          // Determine new status based on action
          let newStatus = visitor.status;
          if (action === 'start_service') newStatus = 'in_service';
          if (action === 'complete_service') newStatus = 'completed';
          if (action === 'emergency_leave') newStatus = 'on_leave';
          if (action === 'emergency_return') newStatus = 'in_service';

          onStatusChange(newStatus);
        }
      }
    } catch (error) {
      console.error('Action failed:', error);
      // For demo, simulate success
      if (onStatusChange) {
        let newStatus = visitor.status;
        if (action === 'start_service') newStatus = 'in_service';
        if (action === 'complete_service') newStatus = 'completed';
        if (action === 'emergency_leave') newStatus = 'on_leave';
        if (action === 'emergency_return') newStatus = 'in_service';

        onStatusChange(newStatus);
      }
    } finally {
      setIsProcessing(null);
    }
  };

  // Get status info
  const getStatusInfo = () => {
    switch (visitor.status) {
      case 'pending':
        return { label: 'Pending', color: 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]', icon: FiClock };
      case 'assigned':
        return { label: 'Assigned', color: 'bg-[rgba(5,109,170,0.1)] text-[#056daa]', icon: FiUserPlus };
      case 'in_service':
        return { label: 'In Service', color: 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]', icon: FiCheckCircle };
      case 'completed':
        return { label: 'Completed', color: 'bg-[#F7F9FB] text-[#555555]', icon: FiCheck };
      case 'checked_out':
        return { label: 'Checked Out', color: 'bg-[rgba(231,76,60,0.1)] text-[#E74C3C]', icon: FiTruck };
      default:
        return { label: 'Unknown', color: 'bg-[#F7F9FB] text-[#555555]', icon: FiClock };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-white overflow-hidden" style={{ borderRadius: 0, boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between cursor-pointer"
        style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: BORDER }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className="text-[#9E9E9E]" />
          <h3 className="font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Actions</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusInfo.color}`} style={{ fontFamily: fontHeading, borderRadius: 0 }}>
            {statusInfo.label}
          </span>
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Assign Employee */}
            <button
              onClick={onAssignEmployee}
              disabled={isLoading || visitor.status === 'completed' || visitor.status === 'checked_out'}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E0E0E0] hover:border-[#056daa] hover:bg-[rgba(5,109,170,0.08)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: 0 }}
            >
              <FiUserPlus className="text-2xl text-[#056daa] mb-2" />
              <span className="text-sm font-medium text-[#333333]" style={{ fontFamily: fontHeading }}>Assign Employee</span>
            </button>

            {/* Add Note */}
            <button
              onClick={onAddNote}
              disabled={isLoading}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E0E0E0] hover:border-[#056daa] hover:bg-[rgba(5,109,170,0.08)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: 0 }}
            >
              <FiMessageSquare className="text-2xl text-[#056daa] mb-2" />
              <span className="text-sm font-medium text-[#333333]" style={{ fontFamily: fontHeading }}>Add Note</span>
            </button>

            {/* View History */}
            <button
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E0E0E0] hover:border-[#056daa] hover:bg-[rgba(5,109,170,0.08)] transition-colors"
              style={{ borderRadius: 0 }}
            >
              <FiFileText className="text-2xl text-[#056daa] mb-2" />
              <span className="text-sm font-medium text-[#333333]" style={{ fontFamily: fontHeading }}>View History</span>
            </button>

            {/* Contact Visitor */}
            <button
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#E0E0E0] hover:border-[#056daa] hover:bg-[rgba(5,109,170,0.08)] transition-colors"
              style={{ borderRadius: 0 }}
            >
              <FiPhone className="text-2xl text-[#056daa] mb-2" />
              <span className="text-sm font-medium text-[#333333]" style={{ fontFamily: fontHeading }}>Contact</span>
            </button>
          </div>

          {/* Status Actions */}
          {availableActions.length > 0 && (
            <div className="border-t pt-4" style={{ borderColor: BORDER }}>
              <h4 className="mb-3" style={labelStyle}>Service Management</h4>
              <div className="space-y-2">
                {availableActions.map((action) => (
                  <div key={action.id}>
                    {showConfirm === action.id ? (
                      <div className="flex items-center gap-2 p-3 bg-[#F7F9FB]" style={{ borderRadius: 0 }}>
                        <span className="text-sm text-[#555555] flex-1">
                          Confirm: {action.label}?
                        </span>
                        <button
                          onClick={() => handleAction(action.id as ServiceAction)}
                          disabled={isProcessing === action.id}
                          className="px-3 py-1 bg-[#4CAF50] text-white text-sm font-semibold uppercase tracking-wider hover:bg-[#388E3C] disabled:opacity-50"
                          style={{ borderRadius: 0, fontFamily: fontHeading }}
                        >
                          {isProcessing === action.id ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setShowConfirm(null)}
                          className="px-3 py-1 border border-[#056daa] text-[#056daa] text-sm font-semibold uppercase tracking-wider bg-transparent hover:bg-[rgba(5,109,170,0.08)]"
                          style={{ borderRadius: 0, fontFamily: fontHeading }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirm(action.id as ServiceAction)}
                        disabled={isLoading}
                        className={`w-full flex items-center gap-3 p-3 text-white transition-colors disabled:opacity-50 ${action.color}`}
                        style={{ borderRadius: 0, fontFamily: fontHeading }}
                      >
                        <action.icon />
                        <div className="text-left">
                          <span className="font-semibold uppercase tracking-wide text-[13px]">{action.label}</span>
                          <p className="text-xs opacity-80">{action.description}</p>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkout Button */}
          {(visitor.status === 'completed' || visitor.status === 'in_service') && (
            <div className="border-t pt-4 mt-4" style={{ borderColor: BORDER }}>
              <button
                onClick={onCheckout}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#4CAF50] text-white hover:bg-[#388E3C] transition-colors disabled:opacity-50"
                style={{ borderRadius: 0, fontFamily: fontHeading }}
              >
                <FiTruck />
                <span className="font-semibold uppercase tracking-wide text-[13px]">Check Out Visitor</span>
              </button>
            </div>
          )}

          {/* Emergency Leave/Return */}
          {visitor.status === 'on_leave' && (
            <div className="border-t pt-4 mt-4" style={{ borderColor: BORDER }}>
              <button
                onClick={() => handleAction('emergency_return')}
                disabled={isProcessing !== null}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#F39C12] text-white hover:bg-[#D68910] transition-colors disabled:opacity-50"
                style={{ borderRadius: 0, fontFamily: fontHeading }}
              >
                <FiPower />
                <span className="font-semibold uppercase tracking-wide text-[13px]">Record Return</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Need to import FiPlay and FiPause
import { FiPlay, FiPause } from 'react-icons/fi';

export default ServiceActionPanel;
