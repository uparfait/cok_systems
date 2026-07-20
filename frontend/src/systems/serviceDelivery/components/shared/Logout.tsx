// Logout Component - Confirmation dialog before logout
import React from 'react';
import { FiLogOut, FiAlertTriangle } from 'react-icons/fi';

const PRIMARY = "#056daa";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface LogoutProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const Logout: React.FC<LogoutProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="w-[400px] max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
      >
        {/* Header */}
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[rgba(243,156,18,0.12)] rounded-full flex items-center justify-center mb-4">
              <FiAlertTriangle className="w-8 h-8" style={{ color: WARNING }} />
            </div>
            <h2 className="text-[20px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Confirm Logout</h2>
            <p className="text-[#555555] text-[13px] mt-2">
              Are you sure you want to logout? Any unsaved changes will be lost.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 uppercase hover:bg-[rgba(5,109,170,0.08)] transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${PRIMARY}`,
              color: PRIMARY,
              borderRadius: 0,
              fontFamily: fontHeading,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 uppercase transition-colors"
            style={{
              backgroundColor: DANGER,
              color: WHITE,
              borderRadius: 0,
              fontFamily: fontHeading,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Logout;
