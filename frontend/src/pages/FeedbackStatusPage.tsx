// FeedbackStatusPage - Service history and feedback status for visitors
// Shows all services for a phone number and the feedback status for each

import React, { useState, useRef, useEffect } from 'react';
import { FiPhone, FiCheckCircle, FiAlertCircle, FiClock, FiStar, FiMessageSquare, FiSearch } from 'react-icons/fi';
import { verifyPhone, getFeedbackByPhone } from '../core/services/feedbackService';
import { useToast } from '../core/contexts/ToastContext';
import FeedbackModal from '../core/components/Modals/FeedbackModal';

interface AssignedDepartment {
  department_id: string;
  department_name: string;
  assigned_time: string;
  reached_in: string;
  provider_name: string;
}

interface FeedbackItem {
  feedback_id?: string;
  department_name: string;
  department_id: string;
  provider_name: string;
  rate: number;
  rate_out_of: number;
  textmessage: string;
  created_date: string;
}

interface FeedbackSummary {
  total_assigned_departments: number;
  completed_feedback: number;
  pending_feedback: number;
  departments_with_feedback: Array<{
    department_id: string;
    department_name: string;
    provider_name: string;
  }>;
  pending_departments: Array<{
    department_id: string;
    department_name: string;
    provider_name: string;
  }>;
}

const FeedbackStatusPage: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [phone, setPhone] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [departments, setDepartments] = useState<AssignedDepartment[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleVerifyPhone = async () => {
    if (!phone.trim()) {
      showError('Please enter your phone number');
      return;
    }

    setIsVerifying(true);
    setIsLoadingFeedback(true);
    setErrorMessage('');

    try {
      const verifyResponse = await verifyPhone(phone.trim());
      setVisitorName(verifyResponse.visitor_name);
      setDepartments(verifyResponse.assigned_departments);

      if (verifyResponse.assigned_departments.length === 0) {
        setErrorMessage('No service records found for this phone number');
        setDepartments([]);
        setFeedback([]);
        setSummary(null);
      } else {
        await loadFeedback(phone.trim());
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No service records found for this number';
      setErrorMessage(message);
      setDepartments([]);
      setFeedback([]);
      setSummary(null);
    } finally {
      setIsVerifying(false);
      setIsLoadingFeedback(false);
    }
  };

  const loadFeedback = async (telephone: string) => {
    try {
      const result = await getFeedbackByPhone(telephone);
      setFeedback(result.feedback);
      setSummary(result.summary);
      if (result.feedback.length > 0) {
        showSuccess(`Found ${result.feedback.length} feedback submission(s)`);
      }
    } catch {
      setFeedback([]);
      const emptySummary = {
        total_assigned_departments: departments.length,
        completed_feedback: 0,
        pending_feedback: departments.length,
        departments_with_feedback: [],
        pending_departments: departments.map((d) => ({
          department_id: d.department_id,
          department_name: d.department_name,
          provider_name: d.provider_name
        }))
      };
      setSummary(emptySummary);
    }
  };

  const getFeedbackForDepartment = (departmentId: string): FeedbackItem | null => {
    return feedback.find(f => f.department_id === departmentId) || null;
  };

  const handleOpenFeedbackModal = () => {
    setIsFeedbackModalOpen(true);
  };

  const handleCloseFeedbackModal = () => {
    setIsFeedbackModalOpen(false);
  };

  const renderStatusBadge = (feedbackItem: FeedbackItem | null) => {
    if (feedbackItem) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 whitespace-nowrap">
          <FiCheckCircle className="w-3 h-3" />
          Submitted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
        <FiClock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const renderStars = (rating: number) => {
    const displayRating = Math.round(rating / 2);
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= displayRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-[11px] font-bold text-gray-700 ml-1">{rating}/10</span>
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
          <FiMessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          Service History & Feedback Status
        </h1>
        <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5">
          Enter your phone number to view your service records and feedback status
        </p>
      </div>

      {/* Phone Input Card */}
      <div className="bg-white border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1">
            <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FiPhone className="w-3.5 h-3.5" />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleVerifyPhone}
              disabled={isVerifying || isLoadingFeedback || !phone.trim()}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {isVerifying || isLoadingFeedback ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Loading...
                </>
              ) : (
                <>
                  <FiSearch className="w-3.5 h-3.5" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 p-3 mb-3 sm:mb-4 flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-[11px] sm:text-xs text-red-700">{errorMessage}</p>
        </div>
      )}

      {!errorMessage && (isVerifying || isLoadingFeedback || departments.length > 0 || feedback.length > 0) && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="bg-white border border-gray-200 p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.total_assigned_departments}</p>
              </div>
              <div className="bg-white border border-gray-200 p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">Completed</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{summary.completed_feedback}</p>
              </div>
              <div className="bg-white border border-gray-200 p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs font-medium text-gray-500">Pending</p>
                <p className="text-lg sm:text-2xl font-bold text-yellow-600">{summary.pending_feedback}</p>
              </div>
            </div>
          )}

          {/* Main Table Card */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-900">Service Records</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {visitorName ? `Visitor: ${visitorName}` : 'Enter a phone number to view records'}
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Provider</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Feedback</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Submitted</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingFeedback ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <span className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                          <span className="text-xs sm:text-sm">Loading feedback...</span>
                        </div>
                      </td>
                    </tr>
                  ) : departments.length > 0 ? (
                    departments.map((dept, index) => {
                      const feedbackItem = getFeedbackForDepartment(dept.department_id);
                      return (
                        <tr key={dept.department_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-4 py-3 text-[11px] sm:text-sm text-gray-500">{index + 1}</td>
                          <td className="px-2 sm:px-4 py-3">
                            <div>
                              <p className="text-xs sm:text-sm font-semibold text-gray-900">{dept.department_name}</p>
                              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                                Assigned: {formatDateShort(dept.assigned_time)}
                              </p>
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-[11px] sm:text-sm text-gray-600 hidden sm:table-cell">{dept.provider_name}</td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            {renderStatusBadge(feedbackItem)}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            {feedbackItem ? (
                              renderStars(feedbackItem.rate)
                            ) : (
                              <span className="text-[11px] sm:text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-[11px] sm:text-sm text-gray-600 hidden md:table-cell">
                            {feedbackItem?.textmessage ? (
                              <span className="line-clamp-2" title={feedbackItem.textmessage}>
                                {feedbackItem.textmessage.length > 60
                                  ? feedbackItem.textmessage.substring(0, 60) + '...'
                                  : feedbackItem.textmessage}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px] sm:text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-[10px] sm:text-xs text-gray-500 hidden sm:table-cell">
                            {feedbackItem?.created_date ? formatDateShort(feedbackItem.created_date) : '-'}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            {feedbackItem ? (
                              <span className="text-[10px] sm:text-xs text-green-600 font-medium">Done</span>
                            ) : (
                              <button
                                onClick={handleOpenFeedbackModal}
                                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-1.5 bg-yellow-500 text-white text-[11px] sm:text-xs font-medium hover:bg-yellow-600 transition-colors"
                              >
                                <FiMessageSquare className="w-3 h-3" />
                                <span className="hidden sm:inline">Submit</span>
                                <span className="sm:hidden">Send</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center">
                        <FiMessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm text-gray-500">No service records found</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Enter a phone number to view your service history</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-[10px] sm:text-xs text-gray-500">
              You can submit feedback once per department. If you received services from multiple departments,
              you can submit separate feedback for each.
            </p>
          </div>
        </>
      )}

      {/* Empty State when not loading and no data */}
      {!errorMessage && !isVerifying && !isLoadingFeedback && departments.length === 0 && feedback.length === 0 && (
        <div className="bg-white border border-gray-200 p-4 sm:p-6 text-center">
          <FiMessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-2 sm:mb-3" />
          <p className="text-xs sm:text-sm font-medium text-gray-900 mb-1">No Service History</p>
          <p className="text-[11px] sm:text-xs text-gray-500">
            Enter your phone number above to view your assigned departments and feedback status
          </p>
        </div>
      )}

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleCloseFeedbackModal}
      />
    </div>
  );
};

export default FeedbackStatusPage;
