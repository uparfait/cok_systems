// AvailabilityTab - Availability settings page with status toggle and success toast
import React, { useState } from 'react';
import { FiInfo, FiCheckCircle } from 'react-icons/fi';

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: "14px",
  backgroundColor: NEUTRAL_LIGHT,
  border: "1px solid transparent",
  borderRadius: 0,
  boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
  color: NEUTRAL_DARK,
};
const focusInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)";
};
const blurInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = "transparent";
  e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)";
};
const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: "#555555",
};

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
        <h1 className="text-[30px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Status Settings</h1>
        <p className="text-[#555555] text-[13px] mt-1.5">Manage your current availability and queue visibility for the City of Kigali KSESM.</p>
      </div>

      {/* Dark Hero Banner Card */}
      <div className="mt-6 p-8 h-[120px] relative overflow-hidden" style={{ backgroundColor: PRIMARY, boxShadow: CARD_SHADOW }}>
        <div className="relative z-10">
          <h2 className="text-white text-[22px] font-bold" style={{ fontFamily: fontHeading }}>Set Availability</h2>
          <p className="text-white/80 text-[13px] mt-1.5">Update your status to inform the queue system.</p>
        </div>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[rgba(255,255,255,0.08)] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 right-20 w-32 h-32 bg-[rgba(255,255,255,0.06)] rounded-full translate-y-1/2"></div>
      </div>

      {/* Status Selection Card */}
      <div className="bg-white p-7 mt-4" style={{ boxShadow: CARD_SHADOW }}>
        <label style={labelStyle}>CURRENT STATUS</label>

        {/* Status Options */}
        <div className="flex justify-center gap-4 mt-4">
          {/* Active / Available Option */}
          <button
            onClick={() => handleStatusChange('active')}
            className={`cok-btn-outlined w-full h-14 p-3 flex items-center gap-3 transition-colors ${currentStatus === 'active' ? 'cok-bg-primary text-white' : 'text-[#333333]'}`}
            style={btnTypography}
          >
            <div className={`w-4 h-4 rounded-full ${currentStatus === 'active' ? 'bg-[#4CAF50]' : 'border-2 border-gray-400'}`}></div>
            <div className="text-left">
              <p className="text-[14px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Active / Available</p>
              <p className="text-[#555555] text-[12px]">Ready to serve new visitors.</p>
            </div>
          </button>

          {/* Away / On Break Option */}
          <button
            onClick={() => handleStatusChange('away')}
            className={`cok-btn-outlined w-full h-14 p-3 flex items-center gap-3 transition-colors ${currentStatus === 'away' ? 'cok-bg-primary text-white' : 'text-[#333333]'}`}
            style={btnTypography}
          >
            <div className={`w-4 h-4 rounded-full ${currentStatus === 'away' ? 'bg-white' : 'border-2 border-white/60'}`}></div>
            <div className="text-left">
              <p className="text-white text-[14px] font-bold" style={{ fontFamily: fontHeading }}>Away / On Break</p>
              <p className="text-white/80 text-[12px]">Temporarily unavailable.</p>
            </div>
          </button>
        </div>

        {/* Reason / Note Section */}
        <div className="mt-6">
          <label style={labelStyle}>REASON / NOTE (OPTIONAL)</label>
          <textarea
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value.slice(0, 140))}
            placeholder="e.g., Taking a 30 min lunch break, Technical issue with printer..."
            className="cok-auth-input w-full h-[90px] p-3.5 mt-3 resize-none"
            style={inputStyle}
            onFocus={focusInput}
            onBlur={blurInput}
          />
          <p className="text-[11px] text-right mt-1" style={{ color: GRAY_DISABLED }}>{reasonNote.length}/140</p>
        </div>

        {/* Update Status Button */}
        <div className="flex justify-end mt-5">
          <button
            onClick={handleUpdateStatus}
            className="cok-btn-primary text-white text-xs flex items-center justify-center w-full h-11"
            style={btnTypography}
          >
            Update Status
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white px-5 py-3.5 flex items-center gap-3" style={{ border: `1px solid ${SUCCESS}`, boxShadow: CARD_SHADOW }}>
            <FiCheckCircle className="w-[18px] h-[18px]" style={{ color: SUCCESS }} />
            <div>
              <p className="text-[14px] font-bold" style={{ fontFamily: fontHeading,  }}>Status updated successfully!</p>
              <p className="text-[#555555] text-[12px]">Your availability has been updated and the head of department has been notified.</p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Card */}
      <div className="flex justify-center mt-8">
        <div className="bg-white p-5 w-[300px] flex items-center justify-between" style={{ boxShadow: CARD_SHADOW }}>
          <div>
            <p className="text-[#555555] text-[12px]">Waiting for you</p>
            <p className="text-[36px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{waitingCount}</p>
            <p className="text-[12px] mt-1" style={{ color: DANGER }}>High demand</p>
          </div>
          <div className="w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(231,76,60,0.1)' }}>
            <svg className="w-6 h-6" style={{ color: DANGER }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
