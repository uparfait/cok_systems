// Department Availability Tab Component

import { useState } from "react";
import { FiCheck, FiClock, FiX, FiInfo, FiSave, FiUsers, FiCalendar, FiCheckCircle, FiPause, FiMinusCircle, FiCircle, FiCheckSquare } from "react-icons/fi";

import AvailabilitySettingsTab from "./AvailabilitySettingsTab";
import EmployeeStatusOverviewTab from "./EmployeeStatusOverviewTab";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

type DepartmentStatus = 'available' | 'busy' | 'at-capacity' | 'closed';

interface DepartmentAvailabilityTabProps {
  departmentId?: string;
}

const DepartmentAvailabilityTab: React.FC<DepartmentAvailabilityTabProps> = ({ departmentId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'availability' | 'employee-status'>('availability');
  const [selectedStatus, setSelectedStatus] = useState<DepartmentStatus | null>(null);

  const statusOptions = [
    {
      id: 'available' as DepartmentStatus,
      label: 'Available',
      icon: FiCheckCircle,
      iconBg: 'rgba(76,175,80,0.12)',
      statusText: 'Available',
      statusColor: SUCCESS,
      quote: 'Department is open and accepting Visitors.'
    },
    {
      id: 'busy' as DepartmentStatus,
      label: 'Busy',
      icon: FiClock,
      iconBg: 'rgba(243,156,18,0.12)',
      statusText: 'Busy',
      statusColor: WARNING,
      quote: 'High volume. Expect delays of 15-30 minutes.'
    },
    {
      id: 'at-capacity' as DepartmentStatus,
      label: 'At Capacity',
      icon: FiMinusCircle,
      iconBg: 'rgba(231,76,60,0.12)',
      statusText: 'At Capacity',
      statusColor: DANGER,
      quote: 'Department is at full capacity currently.'
    },
    {
      id: 'closed' as DepartmentStatus,
      label: 'Closed',
      icon: FiCircle,
      iconBg: 'rgba(158,158,158,0.15)',
      statusText: 'Closed',
      statusColor: GRAY_DISABLED,
      quote: 'Office is currently closed.'
    }
  ];

  const selectedStatusData = statusOptions.find(s => s.id === selectedStatus);

  return (
    <div className="flex gap-6 -mt-4">
      {/* LEFT MAIN CONTENT */}
      <div className="flex-1 min-w-[700px]">
        {/* Page Title Block */}
        <div style={{ padding: '24px' }}>
          <h1 className="text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Department Configuration</h1>
          <p className="text-sm mt-1" style={{ color: '#555555' }}>Manage department availability settings for Reception visibility.</p>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-6 px-6" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <button
            onClick={() => setActiveSubTab('availability')}
            className="pb-3 text-sm font-medium transition-colors"
            style={{
              fontFamily: fontHeading,
              color: activeSubTab === 'availability' ? PRIMARY : GRAY_DISABLED,
              borderBottom: activeSubTab === 'availability' ? `2px solid ${PRIMARY}` : '2px solid transparent'
            }}
          >
            Availability Settings
          </button>
          <button
            onClick={() => setActiveSubTab('employee-status')}
            className="pb-3 text-sm font-medium transition-colors"
            style={{
              fontFamily: fontHeading,
              color: activeSubTab === 'employee-status' ? PRIMARY : GRAY_DISABLED,
              borderBottom: activeSubTab === 'employee-status' ? `2px solid ${PRIMARY}` : '2px solid transparent'
            }}
          >
            Employee Status Overview
          </button>
        </div>

        {/* Tab Content */}
        {activeSubTab === 'availability' && (
          <AvailabilitySettingsTab onStatusSelect={setSelectedStatus} />
        )}

        {activeSubTab === 'employee-status' && (
          <EmployeeStatusOverviewTab departmentId={departmentId} />
        )}
      </div>

      {/* RIGHT PANEL - Only shows in Availability tab when status selected */}
      {activeSubTab === 'availability' && selectedStatus && selectedStatusData && (
        <div className="w-[270px] p-5 flex-shrink-0" style={{ background: NEUTRAL_LIGHT, marginTop: '90px' }}>
          {/* Upper White Card */}
          <div className="bg-white p-5 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <p className="uppercase" style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>Availability</p>

            <div className="w-12 h-12 mx-auto mt-4 flex items-center justify-center" style={{ background: selectedStatusData.iconBg }}>
              {selectedStatus === 'available' ? (
                <FiCheckCircle className="w-8 h-8" style={{ color: selectedStatusData.statusColor }} />
              ) : selectedStatus === 'busy' ? (
                <FiClock className="w-8 h-8" style={{ color: selectedStatusData.statusColor }} />
              ) : selectedStatus === 'at-capacity' ? (
                <FiMinusCircle className="w-8 h-8" style={{ color: selectedStatusData.statusColor }} />
              ) : (
                <FiCircle className="w-8 h-8" style={{ color: selectedStatusData.statusColor }} />
              )}
            </div>
            
            <p className="text-sm font-bold mt-3" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Planning Department</p>
            
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ background: selectedStatusData.statusColor }}></div>
              <span className="text-xs font-semibold" style={{ color: selectedStatusData.statusColor }}>Currently {selectedStatusData.statusText}</span>
            </div>
            
            <p className="text-xs italic mt-3" style={{ color: PRIMARY }}>"{selectedStatusData.quote}"</p>
          </div>

          {/* Lower Colored Card */}
          <div className="p-5 mt-3" style={{ background: selectedStatus === 'available' ? 'rgba(76,175,80,0.12)' : selectedStatus === 'busy' ? 'rgba(243,156,18,0.12)' : 'rgba(231,76,60,0.12)' }}>
            <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              {selectedStatus === 'available' ? 'Ready to Serve' : selectedStatus === 'busy' ? 'Experiencing Delays' : selectedStatus === 'at-capacity' ? 'At Full Capacity' : 'Currently Closed'}
            </p>
            
            <div className="flex items-center gap-2 mt-3">
              <FiUsers className="w-4 h-4" style={{ color: PRIMARY }} />
              <span className="text-xs font-medium" style={{ color: '#555555' }}>
                {selectedStatus === 'available' ? '5/7 Staff Available and ready' : 
                 selectedStatus === 'busy' ? '5/7 Staff handling high volume' : 
                 'Department at full capacity'}
              </span>
            </div>
            
            <div className="w-full h-2 mt-3" style={{ background: BORDER }}>
              <div className="h-full" style={{ width: selectedStatus === 'available' || selectedStatus === 'busy' ? '70%' : '0%', background: selectedStatusData.statusColor }}></div>
            </div>

            {selectedStatus && selectedStatus !== 'closed' && (
              <a href="#" className="block text-xs text-right mt-2 font-medium" style={{ color: PRIMARY }}>View Schedule →</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentAvailabilityTab;
