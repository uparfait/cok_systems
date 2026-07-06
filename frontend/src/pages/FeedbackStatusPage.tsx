// FeedbackStatusPage - Service history and feedback status for visitors
// Shows all services for a phone number and the feedback status for each

import React, { useState } from 'react';
import { FiPhone, FiCheckCircle, FiAlertCircle, FiClock, FiStar, FiMessageSquare } from 'react-icons/fi';
import { verifyPhone, getFeedbackByPhone } from '../core/services/feedbackService';
import { useToast } from '../core/contexts/ToastContext';

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

  const handleVerifyPhone = async () => {
    if (!phone.trim()) {
      showError('Please enter your phone number');
      return;
    }

    setIsVerifying(true);
    setIsLoadingFeedback(true);
    setErrorMessage('');

    try {
      // Verify phone and get assigned departments
      const verifyResponse = await verifyPhone(phone.trim());
      setVisitorName(verifyResponse.visitor_name);
      setDepartments(verifyResponse.assigned_departments);

      if (verifyResponse.assigned_departments.length === 0) {
        setErrorMessage('No service records found for this phone number');
        setDepartments([]);
        setFeedback([]);
        setSummary(null);
      } else {
        // Load all feedback for this phone
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
      // No feedback yet is okay - we'll show pending status
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

  const renderStatusBadge = (departmentId: string) => {
    const feedbackItem = getFeedbackForDepartment(departmentId);
    if (feedbackItem) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <FiCheckCircle className="w-3 h-3" />
          Feedback Submitted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <FiClock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const renderRatingStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.ceil(rating / 2)
                ? rating <= 4
                  ? 'text-red-400 fill-red-400'
                  : rating <= 6
                  ? 'text-orange-400 fill-orange-400'
                  : 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiMessageSquare className="w-6 h-6 text-blue-600" />
          Service History & Feedback Status
        </h1>
        <p className="text-gray-600 mt-1">
          Enter your phone number to view your service records and feedback status
        </p>
      </div>

      {/* Phone Input Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FiPhone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
              />
            </div>
          </div>
          <button
            onClick={handleVerifyPhone}
            disabled={isVerifying || isLoadingFeedback || !phone.trim()}
            className="h-fit px-6 py-2.5 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6 flex items-center gap-2"
          >
            {isVerifying || isLoadingFeedback ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Loading...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700">
            <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{errorMessage}</p>
          </div>
        </div>
      )}

       {!errorMessage && (isVerifying || isLoadingFeedback || departments.length > 0 || feedback.length > 0) && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Services</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total_assigned_departments}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed Feedback</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{summary.completed_feedback}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Feedback</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{summary.pending_feedback}</p>
              </div>
            </div>
          )}

          {/* Service & Feedback Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <FiPhone className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">{phone}</span>
                {visitorName && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm text-gray-600">{visitorName}</span>
                  </>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
               {departments.map((dept) => {
                const feedbackItem = getFeedbackForDepartment(dept.department_id);
                return (
                  <div key={dept.department_id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{dept.department_name}</h3>
                          {renderStatusBadge(dept.department_id)}
                        </div>
                        <p className="text-sm text-gray-600">
                          Provider: <span className="font-medium">{dept.provider_name}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Assigned: {new Date(dept.assigned_time).toLocaleString()}
                        </p>
                      </div>

                      {feedbackItem ? (
                        <button
                          onClick={() => {
                            // Could expand to show feedback details
                          }}
                          className="text-left w-full sm:w-auto"
                        >
                          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                            <div className="flex items-center gap-2 mb-1">
                              <FiCheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-semibold text-green-700 uppercase">Feedback Given</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {renderRatingStars(feedbackItem.rate)}
                              <span className="text-sm font-bold text-green-700">
                                {feedbackItem.rate}/10
                              </span>
                            </div>
                            {feedbackItem.textmessage && (
                              <p className="text-xs text-gray-600 mt-2 italic">
                                "{feedbackItem.textmessage}"
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              Submitted: {new Date(feedbackItem.created_date).toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100 w-full sm:w-auto">
                          <div className="flex items-center gap-2 mb-1">
                            <FiClock className="w-4 h-4 text-yellow-600" />
                            <span className="text-xs font-semibold text-yellow-700 uppercase">Pending</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            You haven't submitted feedback for this service yet
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isLoadingFeedback && departments.length === 0 && !errorMessage && (
              <div className="text-center py-12 text-gray-500">
                <FiAlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Enter your phone number to view your service history</p>
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Note: You can submit feedback once per department. If you received services from multiple departments,
              you can submit separate feedback for each.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackStatusPage;
