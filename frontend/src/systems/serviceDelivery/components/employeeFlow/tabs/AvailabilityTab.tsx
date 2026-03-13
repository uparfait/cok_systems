// AvailabilityTab - Availability settings page with status toggle and success toast
import React, { useState } from 'react';
import { FiInfo, FiCheckCircle } from 'react-icons/fi';

type StatusType = 'active' | 'away';

const AvailabilityTab: React.FC = () => {
  const [currentStatus, setCurrentStatus] = useState<StatusType>('active');
  const [reasonNote, setReasonNote] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [waitingCount] = useState(12);

  const handleStatusChange = (status: StatusType) => {
    setCurrentStatus(status);
  };

  const handleUpdateStatus = () => {
    console.log('Status updated:', { status: currentStatus, reasonNote });
    setShowToast(true);
    // Auto-hide toast after 4 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  return (
    <div className="p-7">
      {/* Page Title Block */}
      <div>
        <h1 className="text-[#1a2744] text-[30px] font-extrabold">Status Settings</h1>
        <p className="text-[#888] text-[13px] mt-1.5">Manage your current availability and queue visibility for the City of Kigali KSESM.</p>
      </div>

      {/* Dark Hero Banner Card */}
      <div className="mt-6 bg-gradient-to-r from-[#1a2744] via-[#2c3e55] to-[#3a4a5c] rounded-[16px] p-8 h-[120px] relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-white text-[22px] font-bold">Set Availability</h2>
          <p className="text-[#ccc] text-[13px] mt-1.5">Update your status to inform the queue system.</p>
        </div>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-900/30 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 right-20 w-32 h-32 bg-gray-700/30 rounded-full translate-y-1/2"></div>
      </div>

      {/* Status Selection Card */}
      <div className="bg-white rounded-[14px] p-7 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <label className="text-[#999] text-[11px] uppercase tracking-wider">CURRENT STATUS</label>
        
        {/* Status Options */}
        <div className="flex justify-center gap-4 mt-4">
          {/* Active / Available Option */}
          <button
            onClick={() => handleStatusChange('active')}
            className={`w-[280px] h-[70px] rounded-[14px] p-5 flex items-center gap-4 transition-all ${
              currentStatus === 'active'
                ? 'bg-white border-2 border-[#34a853] shadow-md'
                : 'bg-gray-50 border border-[#e0e0e0]'
            }`}
          >
            <div className={`w-4 h-4 rounded-full ${currentStatus === 'active' ? 'bg-[#34a853]' : 'border-2 border-gray-400'}`}></div>
            <div className="text-left">
              <p className="text-[#1a2744] text-[14px] font-bold">Active / Available</p>
              <p className="text-[#888] text-[12px]">Ready to serve new visitors.</p>
            </div>
          </button>

          {/* Away / On Break Option */}
          <button
            onClick={() => handleStatusChange('away')}
            className={`w-[280px] h-[70px] rounded-[14px] p-5 flex items-center gap-4 transition-all ${
              currentStatus === 'away'
                ? 'bg-[#cc4400] border-2 border-[#cc4400]'
                : 'bg-[#c0392b] border-2 border-transparent'
            }`}
          >
            <div className={`w-4 h-4 rounded-full ${currentStatus === 'away' ? 'bg-white' : 'border-2 border-white/60'}`}></div>
            <div className="text-left">
              <p className="text-white text-[14px] font-bold">Away / On Break</p>
              <p className="text-white/80 text-[12px]">Temporarily unavailable.</p>
            </div>
          </button>
        </div>

        {/* Reason / Note Section */}
        <div className="mt-6">
          <label className="text-[#999] text-[11px] uppercase tracking-wider">REASON / NOTE (OPTIONAL)</label>
          <textarea
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value.slice(0, 140))}
            placeholder="e.g., Taking a 30 min lunch break, Technical issue with printer..."
            className="w-full h-[90px] border border-[#e0e0e0] rounded-[10px] p-3.5 mt-3 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
          />
          <p className="text-[#bbb] text-[11px] text-right mt-1">{reasonNote.length}/140</p>
        </div>

        {/* Update Status Button */}
        <div className="flex justify-end mt-5">
          <button
            onClick={handleUpdateStatus}
            className="bg-[#e53935] hover:bg-[#c62828] text-white text-[14px] font-bold w-[160px] h-[46px] rounded-[24px] shadow-[0_2px_8px_rgba(229,57,53,0.3)] transition-colors"
          >
            Update Status
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-[10px] px-5 py-3.5 flex items-center gap-3 shadow-[0_2px_12px_rgba(52,168,83,0.2)]">
            <FiCheckCircle className="w-[18px] h-[18px] text-[#34a853]" />
            <div>
              <p className="text-[#2e7d32] text-[14px] font-bold">Status updated successfully!</p>
              <p className="text-[#388e3c] text-[12px]">Your availability has been updated and the head of department has been notified.</p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Card */}
      <div className="flex justify-center mt-8">
        <div className="bg-white rounded-[16px] p-5 w-[300px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center justify-between">
          <div>
            <p className="text-[#888] text-[12px]">Waiting for you</p>
            <p className="text-[#1a2744] text-[36px] font-extrabold">{waitingCount}</p>
            <p className="text-[#e53935] text-[12px] mt-1">High demand</p>
          </div>
          <div className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-[#fce8e6] flex items-center justify-center">
            <svg className="w-6 h-6 text-[#e53935]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityTab;
