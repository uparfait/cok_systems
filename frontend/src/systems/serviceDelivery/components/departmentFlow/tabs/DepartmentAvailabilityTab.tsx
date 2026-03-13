// Department Availability Tab Component

import { useState } from "react";
import { FiCheck, FiClock, FiX, FiInfo, FiSave, FiUsers, FiCalendar, FiCheckCircle, FiPause, FiMinusCircle, FiCircle, FiCheckSquare } from "react-icons/fi";

import AvailabilitySettingsTab from "./AvailabilitySettingsTab";
import EmployeeStatusOverviewTab from "./EmployeeStatusOverviewTab";

type DepartmentStatus = 'available' | 'busy' | 'at-capacity' | 'closed';

const DepartmentAvailabilityTab = () => {
  const [activeSubTab, setActiveSubTab] = useState<'availability' | 'employee-status'>('availability');
  const [selectedStatus, setSelectedStatus] = useState<DepartmentStatus | null>(null);

  const statusOptions = [
    {
      id: 'available' as DepartmentStatus,
      label: 'Available',
      icon: FiCheckCircle,
      iconBg: '#e6f4ea',
      statusText: 'Available',
      statusColor: '#34a853',
      quote: 'Department is open and accepting Visitors.'
    },
    {
      id: 'busy' as DepartmentStatus,
      label: 'Busy',
      icon: FiClock,
      iconBg: '#fff3e0',
      statusText: 'Busy',
      statusColor: '#ff9800',
      quote: 'High volume. Expect delays of 15-30 minutes.'
    },
    {
      id: 'at-capacity' as DepartmentStatus,
      label: 'At Capacity',
      icon: FiMinusCircle,
      iconBg: '#fce8e6',
      statusText: 'At Capacity',
      statusColor: '#ea4335',
      quote: 'Department is at full capacity currently.'
    },
    {
      id: 'closed' as DepartmentStatus,
      label: 'Closed',
      icon: FiCircle,
      iconBg: '#fce8e6',
      statusText: 'Closed',
      statusColor: '#b71c1c',
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
          <h1 className="text-lg font-bold" style={{ color: '#1a2744' }}>Department Configuration</h1>
          <p className="text-sm mt-1" style={{ color: '#666' }}>Manage department availability settings for Reception visibility.</p>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-6 px-6" style={{ borderBottom: '1px solid #e0e0e0' }}>
          <button
            onClick={() => setActiveSubTab('availability')}
            className="pb-3 text-sm font-medium transition-colors"
            style={{
              color: activeSubTab === 'availability' ? '#1a73e8' : '#999',
              borderBottom: activeSubTab === 'availability' ? '2px solid #1a73e8' : '2px solid transparent'
            }}
          >
            Availability Settings
          </button>
          <button
            onClick={() => setActiveSubTab('employee-status')}
            className="pb-3 text-sm font-medium transition-colors"
            style={{
              color: activeSubTab === 'employee-status' ? '#1a73e8' : '#999',
              borderBottom: activeSubTab === 'employee-status' ? '2px solid #1a73e8' : '2px solid transparent'
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
          <EmployeeStatusOverviewTab />
        )}
      </div>

      {/* RIGHT PANEL - Only shows in Availability tab when status selected */}
      {activeSubTab === 'availability' && selectedStatus && selectedStatusData && (
        <div className="w-[270px] p-5 flex-shrink-0" style={{ background: '#f5eded', marginTop: '90px' }}>
          {/* Upper White Card */}
          <div className="bg-white rounded-lg p-5 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1a2744' }}>Availability</p>
            
            <div className="w-12 h-12 rounded-full mx-auto mt-4 flex items-center justify-center" style={{ background: selectedStatusData.iconBg }}>
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
            
            <p className="text-sm font-bold mt-3" style={{ color: '#1a2744' }}>Planning Department</p>
            
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ background: selectedStatusData.statusColor }}></div>
              <span className="text-xs font-semibold" style={{ color: selectedStatusData.statusColor }}>Currently {selectedStatusData.statusText}</span>
            </div>
            
            <p className="text-xs italic mt-3" style={{ color: '#1a73e8' }}>"{selectedStatusData.quote}"</p>
          </div>

          {/* Lower Colored Card */}
          <div className="rounded-lg p-5 mt-3" style={{ background: selectedStatus === 'available' ? '#e6f4ea' : selectedStatus === 'busy' ? '#fff3e0' : '#fce8e6' }}>
            <p className="text-sm font-bold" style={{ color: '#1a2744' }}>
              {selectedStatus === 'available' ? 'Ready to Serve' : selectedStatus === 'busy' ? 'Experiencing Delays' : selectedStatus === 'at-capacity' ? 'At Full Capacity' : 'Currently Closed'}
            </p>
            
            <div className="flex items-center gap-2 mt-3">
              <FiUsers className="w-4 h-4" style={{ color: '#1a73e8' }} />
              <span className="text-xs font-medium" style={{ color: '#666' }}>
                {selectedStatus === 'available' ? '5/7 Staff Available and ready' : 
                 selectedStatus === 'busy' ? '5/7 Staff handling high volume' : 
                 'Department at full capacity'}
              </span>
            </div>
            
            <div className="w-full h-2 rounded mt-3" style={{ background: '#e0e0e0' }}>
              <div className="h-full rounded" style={{ width: selectedStatus === 'available' || selectedStatus === 'busy' ? '70%' : '0%', background: selectedStatusData.statusColor }}></div>
            </div>
            
            {selectedStatus && selectedStatus !== 'closed' && (
              <a href="#" className="block text-xs text-right mt-2 font-medium" style={{ color: '#1a73e8' }}>View Schedule →</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentAvailabilityTab;
