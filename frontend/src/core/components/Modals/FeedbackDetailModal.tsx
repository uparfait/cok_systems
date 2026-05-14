// FeedbackDetailModal - View full feedback details
// Simple modal showing message, rating, department and other details

import React from 'react';
import { FiX, FiStar, FiMessageSquare, FiUser, FiCalendar, FiHash } from 'react-icons/fi';

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
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiMessageSquare className="w-5 h-5 text-blue-600" />
              Feedback Details
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <FiUser className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Visitor</p>
                  <p className="text-sm font-medium text-gray-900">{feedback.user_name || 'Anonymous'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FiHash className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Rating</p>
                  <p className={`text-lg font-bold ${getRatingColor(feedback.rate)}`}>
                    {getRatingStars(feedback.rate)} ({feedback.rate}/10)
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FiMessageSquare className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm font-medium text-gray-900">{feedback.department_name || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FiMessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Message</p>
                <p className="text-sm text-gray-900 mt-1 bg-gray-50 p-3 rounded-lg">
                  {feedback.textmessage || 'No feedback message provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm text-gray-900">
                  {feedback.created_date ? new Date(feedback.created_date).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
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