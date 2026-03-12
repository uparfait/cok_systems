// Availability Settings Tab Component

import { useState } from "react";
import { FiCheck, FiClock, FiX, FiInfo, FiSave, FiUsers, FiCheckCircle, FiMinusCircle, FiCircle, FiCheckSquare } from "react-icons/fi";

type DepartmentStatus = 'available' | 'busy' | 'at-capacity' | 'closed';

interface AvailabilitySettingsTabProps {
  onStatusSelect?: (status: DepartmentStatus | null) => void;
}

const AvailabilitySettingsTab: React.FC<AvailabilitySettingsTabProps> = ({ onStatusSelect }) => {
  const [selectedStatus, setSelectedStatus] = useState<DepartmentStatus | null>(null);
  const [statusComment, setStatusComment] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const statusOptions = [
    {
      id: 'available' as DepartmentStatus,
      label: 'Available',
      description: 'Ready to accept new requests immediately',
      icon: FiCheckCircle,
      iconBg: '#e6f4ea',
      iconColor: '#34a853',
      dotColor: '#34a853',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      statusText: 'Available',
      statusColor: '#34a853',
      quote: 'Department is open and accepting Visitors.'
    },
    {
      id: 'busy' as DepartmentStatus,
      label: 'Busy',
      description: 'High volume, expect delays (15-30 mins)',
      icon: FiClock,
      iconBg: '#fff3e0',
      iconColor: '#ff9800',
      dotColor: '#ff9800',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      statusText: 'Busy',
      statusColor: '#ff9800',
      quote: 'High volume. Expect delays of 15-30 minutes.'
    },
    {
      id: 'at-capacity' as DepartmentStatus,
      label: 'At Capacity',
      description: 'Cannot accept new requests currently',
      icon: FiMinusCircle,
      iconBg: '#fce8e6',
      iconColor: '#ea4335',
      dotColor: '#ea4335',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      statusText: 'At Capacity',
      statusColor: '#ea4335',
      quote: 'Department is at full capacity currently.'
    },
    {
      id: 'closed' as DepartmentStatus,
      label: 'Closed',
      description: 'Office closed for Some reasons',
      icon: FiCircle,
      iconBg: '#fce8e6',
      iconColor: '#b71c1c',
      dotColor: '#b71c1c',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      statusText: 'Closed',
      statusColor: '#b71c1c',
      quote: 'Office is currently closed.'
    }
  ];

  const selectedStatusData = statusOptions.find(s => s.id === selectedStatus);

  const handleUpdateStatus = () => {
    if (selectedStatus) {
      const status = statusOptions.find(s => s.id === selectedStatus);
      setSuccessMessage(`Department status updated to ${status?.label} successfully!`);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    }
  };

  const handleStatusSelect = (statusId: DepartmentStatus) => {
    setSelectedStatus(statusId);
    setShowSuccess(false);
    if (onStatusSelect) {
      onStatusSelect(statusId);
    }
  };

  return (
    <div className="bg-white mx-6 mt-6 rounded-lg p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      {/* Section Title */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#222' }}>Current Department Status</h2>
          <p className="text-xs mt-1" style={{ color: '#888' }}>Select the operational status that will be displayed to citizens.</p>
        </div>
        <FiInfo className="w-4 h-4" style={{ color: '#888' }} />
      </div>

      {/* Status Options */}
      <div className="mt-5 space-y-[10px]">
        {statusOptions.map((status) => (
          <button
            key={status.id}
            onClick={() => handleStatusSelect(status.id)}
            className="w-full flex items-center justify-between p-4 rounded-lg transition-all"
            style={{
              background: selectedStatus === status.id ? (status.id === 'available' ? '#f0fff4' : '#ffffff') : status.background,
              border: selectedStatus === status.id ? status.border : status.border
            }}
          >
            <div className="flex items-center gap-4">
              {/* Radio Button */}
              <div
                className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: selectedStatus === status.id ? status.dotColor : '#999',
                  background: selectedStatus === status.id ? status.dotColor : 'transparent'
                }}
              >
                {selectedStatus === status.id && (
                  <div className="w-[6px] h-[6px] rounded-full bg-white" />
                )}
              </div>

              {/* Icon Badge */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: status.iconBg }}
              >
                <status.icon className="w-5 h-5" style={{ color: status.iconColor }} />
              </div>

              {/* Text Block */}
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: '#222' }}>{status.label}</p>
                <p className="text-xs" style={{ color: '#666' }}>{status.description}</p>
              </div>
            </div>

            {/* Colored Dot Indicator */}
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: status.dotColor }}
            />
          </button>
        ))}
      </div>

      {/* Status Comment Section */}
      <div className="mt-5 pt-5" style={{ borderTop: '1px solid #e0e0e0' }}>
        <label className="flex items-center gap-1">
          <span className="text-sm font-bold" style={{ color: '#222' }}>Status Comment / Reason</span>
          <span className="text-xs" style={{ color: '#ff9800' }}>(Optional)</span>
        </label>
        <textarea
          value={statusComment}
          onChange={(e) => setStatusComment(e.target.value)}
          placeholder="e.g., Internal team meeting until 2 PM. Please check back later."
          className="w-full mt-2 p-3 rounded-lg border resize-none"
          style={{
            border: '1px solid #e0e0e0',
            fontSize: '13px',
            height: '90px'
          }}
        />
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mt-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#e6f4ea', border: '1px solid #34a853' }}>
          <FiCheckSquare className="w-4 h-4" style={{ color: '#34a853' }} />
          <span className="text-sm font-medium" style={{ color: '#34a853' }}>{successMessage}</span>
        </div>
      )}

      {/* Card Footer */}
      <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid #e0e0e0' }}>
        <p className="text-xs" style={{ color: '#888' }}>Visible to internal staff only</p>
        <button
          onClick={handleUpdateStatus}
          disabled={!selectedStatus}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${selectedStatus ? 'text-white' : 'text-gray-400 cursor-not-allowed'}`}
          style={{ background: selectedStatus ? '#1a73e8' : '#e0e0e0' }}
        >
          <FiSave className="w-4 h-4" />
          Update Department Status
        </button>
      </div>
    </div>
  );
};

export default AvailabilitySettingsTab;
