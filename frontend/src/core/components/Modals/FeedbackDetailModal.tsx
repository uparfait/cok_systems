import React from 'react';
import { FiStar, FiMessageSquare, FiUser, FiCalendar, FiHash } from 'react-icons/fi';
import OverlayShell from '../overlay/OverlayShell';

const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";

const detailLabelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
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

  if (!isOpen || !feedback) return null;

  const filledStars = Math.max(0, Math.min(5, Math.round((feedback.rate || 0) / 2)));

  return (
    <OverlayShell
      title={
        <span className="flex items-center gap-2">
          <FiMessageSquare className="w-5 h-5 shrink-0" style={{ color: PRIMARY }} />
          Feedback Details
        </span>
      }
      onClose={onClose}
      width="sm"
    >
      <div className="space-y-4">
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
              <p className={`text-lg font-bold flex items-center gap-1 ${getRatingColor(feedback.rate)}`}>
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FiStar key={star} className="w-4 h-4" style={{ fill: star <= filledStars ? 'currentColor' : 'transparent' }} />
                  ))}
                </span>
                ({feedback.rate}/10)
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
    </OverlayShell>
  );
};

export default FeedbackDetailModal;
