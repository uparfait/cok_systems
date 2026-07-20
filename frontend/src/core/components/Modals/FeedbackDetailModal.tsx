// FeedbackDetailModal - View full feedback details
// Simple modal showing message, rating, department and other details

import React from 'react';
import { FiX, FiStar, FiMessageSquare, FiUser, FiCalendar, FiHash } from 'react-icons/fi';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const detailLabelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  borderRadius: 0,
};

interface FeedbackDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: {
    _id?: string;
    user_name?: string;
    department_name?: string;
    rate: number;
    textmessage?: string;
    created_date?: string;
    telephone?: string;
  } | null;
}

const FeedbackDetailModal: React.FC<FeedbackDetailModalProps> = ({ isOpen, onClose, feedback }) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingStars = (rating: number) => {
    const stars = Math.round(rating / 2);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  if (!isOpen || !feedback) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white" style={{ borderRadius: 0, border: `2px solid ${PRIMARY}`, boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              <FiMessageSquare className="w-5 h-5" style={{ color: PRIMARY }} />
              Feedback Details
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" style={{ borderRadius: 0 }}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <FiUser className="w-4 h-4 text-gray-400" />
                <div>
                  <p style={detailLabelStyle}>Visitor</p>
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{feedback.user_name || 'Anonymous'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FiHash className="w-4 h-4 text-gray-400" />
                <div>
                  <p style={detailLabelStyle}>Rating</p>
                  <p className={`text-lg font-bold ${getRatingColor(feedback.rate)}`}>
                    {getRatingStars(feedback.rate)} ({feedback.rate}/10)
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FiMessageSquare className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <p style={detailLabelStyle}>Department</p>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{feedback.department_name || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FiMessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p style={detailLabelStyle}>Message</p>
                <p className="text-sm mt-1 p-3" style={{ color: NEUTRAL_DARK, backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid #E0E0E0' }}>
                  {feedback.textmessage || 'No feedback message provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-gray-400" />
              <div>
                <p style={detailLabelStyle}>Date</p>
                <p className="text-sm text-gray-900">
                  {feedback.created_date ? new Date(feedback.created_date).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 transition-colors"
              style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDetailModal;