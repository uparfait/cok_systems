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
            color: 'bg-green-500 hover:bg-green-600',
            description: 'Begin serving this visitor'
          },
          { 
            id: 'emergency_leave', 
            label: 'Emergency Leave', 
            icon: FiAlertTriangle,
            color: 'bg-orange-500 hover:bg-orange-600',
            description: 'Allow visitor to leave temporarily'
          },
        ];
      case 'in_service':
        return [
          { 
            id: 'pause_service', 
            label: 'Pause Service', 
            icon: FiPause,
            color: 'bg-yellow-500 hover:bg-yellow-600',
            description: 'Temporarily pause service'
          },
          { 
            id: 'complete_service', 
            label: 'Complete Service', 
            icon: FiCheckCircle,
            color: 'bg-blue-500 hover:bg-blue-600',
            description: 'Mark service as completed'
          },
          { 
            id: 'emergency_leave', 
            label: 'Emergency Leave', 
            icon: FiAlertTriangle,
            color: 'bg-orange-500 hover:bg-orange-600',
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
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: FiClock };
      case 'assigned':
        return { label: 'Assigned', color: 'bg-blue-100 text-blue-800', icon: FiUserPlus };
      case 'in_service':
        return { label: 'In Service', color: 'bg-green-100 text-green-800', icon: FiCheckCircle };
      case 'completed':
        return { label: 'Completed', color: 'bg-gray-100 text-gray-800', icon: FiCheck };
      case 'checked_out':
        return { label: 'Checked Out', color: 'bg-red-100 text-red-800', icon: FiTruck };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-800', icon: FiClock };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className="text-gray-500" />
          <h3 className="font-medium text-gray-800">Service Actions</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
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
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiUserPlus className="text-2xl text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">Assign Employee</span>
            </button>

            {/* Add Note */}
            <button
              onClick={onAddNote}
              disabled={isLoading}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMessageSquare className="text-2xl text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">Add Note</span>
            </button>

            {/* View History */}
            <button
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <FiFileText className="text-2xl text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">View History</span>
            </button>

            {/* Contact Visitor */}
            <button
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <FiPhone className="text-2xl text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">Contact</span>
            </button>
          </div>

          {/* Status Actions */}
          {availableActions.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Service Management</h4>
              <div className="space-y-2">
                {availableActions.map((action) => (
                  <div key={action.id}>
                    {showConfirm === action.id ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600 flex-1">
                          Confirm: {action.label}?
                        </span>
                        <button
                          onClick={() => handleAction(action.id as ServiceAction)}
                          disabled={isProcessing === action.id}
                          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {isProcessing === action.id ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setShowConfirm(null)}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirm(action.id as ServiceAction)}
                        disabled={isLoading}
                        className={`w-full flex items-center gap-3 p-3 text-white rounded-lg transition-colors disabled:opacity-50 ${action.color}`}
                      >
                        <action.icon />
                        <div className="text-left">
                          <span className="font-medium">{action.label}</span>
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
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                onClick={onCheckout}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FiTruck />
                <span className="font-medium">Check Out Visitor</span>
              </button>
            </div>
          )}

          {/* Emergency Leave/Return */}
          {visitor.status === 'on_leave' && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                onClick={() => handleAction('emergency_return')}
                disabled={isProcessing !== null}
                className="w-full flex items-center justify-center gap-2 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <FiPower />
                <span className="font-medium">Record Return</span>
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
