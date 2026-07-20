// Availability Settings Tab Component

import { useState } from "react";
import { FiCheck, FiClock, FiX, FiInfo, FiSave, FiUsers, FiCheckCircle, FiMinusCircle, FiCircle, FiCheckSquare } from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
      iconBg: 'rgba(76,175,80,0.12)',
      iconColor: SUCCESS,
      dotColor: SUCCESS,
      background: WHITE,
      border: `1px solid ${BORDER}`,
      statusText: 'Available',
      statusColor: SUCCESS,
      quote: 'Department is open and accepting Visitors.'
    },
    {
      id: 'busy' as DepartmentStatus,
      label: 'Busy',
      description: 'High volume, expect delays (15-30 mins)',
      icon: FiClock,
      iconBg: 'rgba(243,156,18,0.12)',
      iconColor: WARNING,
      dotColor: WARNING,
      background: WHITE,
      border: `1px solid ${BORDER}`,
      statusText: 'Busy',
      statusColor: WARNING,
      quote: 'High volume. Expect delays of 15-30 minutes.'
    },
    {
      id: 'at-capacity' as DepartmentStatus,
      label: 'At Capacity',
      description: 'Cannot accept new requests currently',
      icon: FiMinusCircle,
      iconBg: 'rgba(231,76,60,0.12)',
      iconColor: DANGER,
      dotColor: DANGER,
      background: WHITE,
      border: `1px solid ${BORDER}`,
      statusText: 'At Capacity',
      statusColor: DANGER,
      quote: 'Department is at full capacity currently.'
    },
    {
      id: 'closed' as DepartmentStatus,
      label: 'Closed',
      description: 'Office closed for Some reasons',
      icon: FiCircle,
      iconBg: 'rgba(158,158,158,0.15)',
      iconColor: GRAY_DISABLED,
      dotColor: GRAY_DISABLED,
      background: WHITE,
      border: `1px solid ${BORDER}`,
      statusText: 'Closed',
      statusColor: GRAY_DISABLED,
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
    <div className="bg-white mx-6 mt-6 p-6" style={{ boxShadow: CARD_SHADOW }}>
      {/* Section Title */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Current Department Status</h2>
          <p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>Select the operational status that will be displayed to citizens.</p>
        </div>
        <FiInfo className="w-4 h-4" style={{ color: GRAY_DISABLED }} />
      </div>

      {/* Status Options */}
      <div className="mt-5 space-y-[10px]">
        {statusOptions.map((status) => (
          <button
            key={status.id}
            onClick={() => handleStatusSelect(status.id)}
            className="w-full flex items-center justify-between p-4 transition-colors"
            style={{
              background: selectedStatus === status.id ? (status.id === 'available' ? 'rgba(76,175,80,0.08)' : WHITE) : status.background,
              border: selectedStatus === status.id ? status.border : status.border
            }}
          >
            <div className="flex items-center gap-4">
              {/* Radio Button */}
              <div
                className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: selectedStatus === status.id ? status.dotColor : GRAY_DISABLED,
                  background: selectedStatus === status.id ? status.dotColor : 'transparent'
                }}
              >
                {selectedStatus === status.id && (
                  <div className="w-[6px] h-[6px] rounded-full bg-white" />
                )}
              </div>

              {/* Icon Badge */}
              <div
                className="w-9 h-9 flex items-center justify-center"
                style={{ background: status.iconBg }}
              >
                <status.icon className="w-5 h-5" style={{ color: status.iconColor }} />
              </div>

              {/* Text Block */}
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{status.label}</p>
                <p className="text-xs" style={{ color: '#555555' }}>{status.description}</p>
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
      <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
        <label className="flex items-center gap-1">
          <span style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Status Comment / Reason</span>
          <span className="text-xs" style={{ color: WARNING }}>(Optional)</span>
        </label>
        <textarea
          value={statusComment}
          onChange={(e) => setStatusComment(e.target.value)}
          placeholder="e.g., Internal team meeting until 2 PM. Please check back later."
          className="w-full mt-2 p-3 resize-none focus:outline-none"
          style={{
            border: '1px solid transparent',
            borderRadius: 0,
            background: NEUTRAL_LIGHT,
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
            fontFamily: fontHeading,
            fontSize: '14px',
            height: '90px'
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `1px solid ${PRIMARY}`;
            e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1px solid transparent';
            e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
          }}
        />
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mt-4 p-3 flex items-center gap-2" style={{ background: 'rgba(76,175,80,0.12)', border: `1px solid ${SUCCESS}` }}>
          <FiCheckSquare className="w-4 h-4" style={{ color: SUCCESS }} />
          <span className="text-sm font-medium" style={{ color: SUCCESS }}>{successMessage}</span>
        </div>
      )}

      {/* Card Footer */}
      <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <p className="text-xs" style={{ color: GRAY_DISABLED }}>Visible to internal staff only</p>
        <button
          onClick={handleUpdateStatus}
          disabled={!selectedStatus}
          className={`flex items-center gap-2 px-6 py-3 font-semibold uppercase transition-colors ${selectedStatus ? 'text-white' : 'text-white cursor-not-allowed'}`}
          style={{ background: selectedStatus ? PRIMARY : GRAY_DISABLED, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', letterSpacing: '1px' }}
          onMouseEnter={(e) => { if (selectedStatus) e.currentTarget.style.background = PRIMARY_HOVER; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = selectedStatus ? PRIMARY : GRAY_DISABLED; }}
        >
          <FiSave className="w-4 h-4" />
          Update Department Status
        </button>
      </div>
    </div>
  );
};

export default AvailabilitySettingsTab;
