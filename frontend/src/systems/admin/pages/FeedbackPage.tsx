import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService, feedbackService, departmentService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiStar, FiTrendingUp, FiRefreshCw, FiMessageSquare,
  FiBarChart2, FiUsers, FiAward, FiTarget, FiEye, FiX
} from 'react-icons/fi';

// Types
interface FeedbackItem {
  _id: string;
  department_name?: string;
  rate: number;
  rate_out_of: number;
  textmessage?: string;
  created_date?: string;
  user_name?: string;
  telephone?: string;
  provider_name?: string;
  department_id?: string;
}

// Enhanced DepartmentRating with ID
interface DepartmentRating {
  department: string;
  department_id: string;
  average_rating: number;
  total_feedback: number;
  average_out_of: number;
}

const FeedbackPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [departmentRatings, setDepartmentRatings] = useState<DepartmentRating[]>([]);
  const [overallAverage, setOverallAverage] = useState<{ average_rating: number; total_feedback: number }>({
    average_rating: 0,
    total_feedback: 0
  });
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [selectedDepartmentForFeedback, setSelectedDepartmentForFeedback] = useState<{ name: string; id: string } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Fetch feedback data (including department IDs)
  const fetchFeedbackData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch departments first (to get name-to-id mapping)
      const deptResponse = await departmentService.getAll();
      const departmentMap = new Map<string, string>();
      if (deptResponse.success && deptResponse.data) {
        deptResponse.data.forEach((dept: any) => {
          departmentMap.set(dept.department_name, dept.department_id);
        });
      }

      // Fetch analytics
      const [avgRes, totalsRes] = await Promise.all([
        statisticsService.getFeedbackAverageByDepartment(),
        statisticsService.getFeedbackTotals()
      ]);

      // Process department averages with IDs
      const avgData = avgRes?.data || {};
      if (avgData?.by_department) {
        const deptRatings: DepartmentRating[] = Object.entries(avgData.by_department).map(([deptName, data]: [string, any]) => {
          const departmentId = departmentMap.get(deptName) || '';
          if (!departmentId) {
            console.warn(`No department ID found for "${deptName}". Feedback loading may fail.`);
          }
          return {
            department: deptName,
            department_id: departmentId,
            average_rating: data.average_rating || 0,
            total_feedback: data.total_feedback || 0,
            average_out_of: data.average_out_of || 5
          };
        });
        setDepartmentRatings(deptRatings.sort((a, b) => b.average_rating - a.average_rating));
        setDepartments(deptRatings.map(d => d.department));
      }

      // Set overall metrics
      if (avgData?.overall_average) {
        setOverallAverage(avgData.overall_average);
      }

      const totalsData = totalsRes?.data || {};
      setTotalFeedback(totalsData?.total || 0);

    } catch (error) {
      console.error('Error fetching feedback data:', error);
      showError('Failed to load feedback analytics');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [showError]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchFeedbackData();
    }
  }, [isAuthenticated, authLoading, fetchFeedbackData]);

  // Calculate performance insights
  const getPerformanceInsights = () => {
    const total = departmentRatings.reduce((sum, dept) => sum + dept.total_feedback, 0);
    const excellent = departmentRatings.filter(d => d.average_rating >= 4.5).reduce((sum, d) => sum + d.total_feedback, 0);
    const good = departmentRatings.filter(d => d.average_rating >= 3.5 && d.average_rating < 4.5).reduce((sum, d) => sum + d.total_feedback, 0);
    const needsImprovement = total - excellent - good;

    return { total, excellent, good, needsImprovement };
  };

  const insights = getPerformanceInsights();

  // Fetch feedback messages for a department using its ID
  const fetchDepartmentFeedback = useCallback(async (departmentName: string, departmentId: string) => {
    if (!departmentId) {
      showError(`Cannot load feedback: missing department ID for ${departmentName}`);
      return;
    }

    // Clear previous data and show loading for the new department
    setFeedbackList([]);
    setSelectedDepartmentForFeedback({ name: departmentName, id: departmentId });
    setFeedbackLoading(true);

    try {
      const response = await feedbackService.searchByDepartment(departmentId, 1, 100);

      if (response.success) {
        const feedbackData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setFeedbackList(feedbackData);

        // Scroll to feedback messages section
        setTimeout(() => {
          const element = document.getElementById('feedback-messages-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        setFeedbackList([]);
        showError(`Failed to load feedback for ${departmentName}`);
      }
    } catch (error) {
      console.error('Error fetching department feedback:', error);
      setFeedbackList([]);
      showError('Failed to load feedback messages. Please try again.');
    } finally {
      setFeedbackLoading(false);
    }
  }, [showError]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-4">
                <FiBarChart2 className="w-10 h-10 text-blue-600" />
                Feedback Analytics Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Comprehensive insights into visitor satisfaction and departmental performance</p>
            </div>
            <button
              onClick={fetchFeedbackData}
              disabled={loading}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Feedback</p>
                <p className="text-3xl font-bold text-gray-900">{totalFeedback.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">All time submissions</p>
              </div>
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
                <FiMessageSquare className="w-7 h-7 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Average Rating</p>
                <p className="text-3xl font-bold text-yellow-600">{overallAverage.average_rating?.toFixed(1) || '0.0'}</p>
                <div className="flex mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FiStar
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(overallAverage.average_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="w-14 h-14 bg-yellow-50 rounded-xl flex items-center justify-center">
                <FiStar className="w-7 h-7 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Active Departments</p>
                <p className="text-3xl font-bold text-purple-600">{departments.length}</p>
                <p className="text-xs text-gray-400 mt-1">Receiving feedback</p>
              </div>
              <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center">
                <FiTarget className="w-7 h-7 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Satisfaction Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {insights.total > 0 ? Math.round(((insights.excellent + insights.good) / insights.total) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-400 mt-1">Excellent + Good ratings</p>
              </div>
              <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center">
                <FiTrendingUp className="w-7 h-7 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Department Rankings - Simplified Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <FiAward className="w-6 h-6 text-yellow-600" />
            Department Performance Rankings
          </h2>

          {departmentRatings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentRatings.slice(0, 9).map((dept, index) => (
                <div key={dept.department} className="bg-gradient-to-r from-white to-gray-50 rounded-lg p-4 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{dept.department}</h3>
                        <p className="text-xs text-gray-500">{dept.total_feedback} reviews</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FiStar
                          key={star}
                          className={`w-4 h-4 ${star <= Math.round(dept.average_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-bold text-gray-900">{dept.average_rating?.toFixed(1)}</span>
                  </div>

                  <div className="mt-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      dept.average_rating >= 4.5 ? 'bg-green-100 text-green-800' :
                      dept.average_rating >= 3.5 ? 'bg-blue-100 text-blue-800' :
                      dept.average_rating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                      dept.average_rating >= 1.5 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {dept.average_rating >= 4.5 ? 'Excellent' :
                       dept.average_rating >= 3.5 ? 'Good' :
                       dept.average_rating >= 2.5 ? 'Average' :
                       dept.average_rating >= 1.5 ? 'Poor' : 'Very Poor'}
                    </span>
                    <button
                      onClick={() => fetchDepartmentFeedback(dept.department, dept.department_id)}
                      disabled={!dept.department_id}
                      className="ml-3 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 inline-flex disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!dept.department_id ? "Department ID missing" : "View messages"}
                    >
                      <FiEye className="w-4 h-4" />
                      View Messages
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiAward className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No ranking data available</p>
            </div>
          )}
        </div>

        {/* Feedback Messages Section - Conditionally Rendered */}
        {selectedDepartmentForFeedback && (
          <div key={selectedDepartmentForFeedback.id} id="feedback-messages-section" className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <FiMessageSquare className="w-6 h-6 text-blue-600" />
                  Feedback Messages - {selectedDepartmentForFeedback.name}
                </h2>
                <button
                  onClick={() => {
                    setFeedbackList([]);
                    setSelectedDepartmentForFeedback(null);
                    setFeedbackLoading(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close messages"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {feedbackLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="ml-3 text-gray-500">Loading feedback messages...</span>
                </div>
              ) : feedbackList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Comment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {feedbackList.map((feedback, index) => (
                        <tr key={feedback._id || index} className="hover:bg-gray-50 transition-colors">
                           <td className="px-4 py-3">
                             <div className="flex items-center">
                               <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                 <FiMessageSquare className="w-4 h-4 text-blue-600" />
                               </div>
                               <span className="ml-3 font-medium text-gray-900">
                                 {feedback.user_name || 'Anonymous'}
                               </span>
                             </div>
                            </td>
                           <td className="px-4 py-3">
                             <div className="flex items-center gap-2">
                               <span className="font-bold text-gray-900">{feedback.rate || 0}/{feedback.rate_out_of || 10}</span>
                               <div className="flex">
                                 {[1, 2, 3, 4, 5].map((star) => (
                                   <FiStar
                                     key={star}
                                     className={`w-3 h-3 ${star <= Math.round((feedback.rate || 0) / (feedback.rate_out_of || 10) * 5) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                   />
                                 ))}
                               </div>
                             </div>
                            </td>
                           <td className="px-4 py-3 max-w-xs">
                             <div className="text-gray-700">
                               {feedback.textmessage ? (
                                 <span className="line-clamp-2" title={feedback.textmessage}>
                                   {feedback.textmessage.length > 100 ? feedback.textmessage.substring(0, 100) + '...' : feedback.textmessage}
                                 </span>
                               ) : (
                                 <span className="text-gray-400 italic">No message</span>
                               )}
                             </div>
                            </td>
                           <td className="px-4 py-3 text-sm text-gray-600">
                             {feedback.created_date ? new Date(feedback.created_date).toLocaleDateString() : 'N/A'}
                            </td>
                           <td className="px-4 py-3 text-sm text-gray-600">
                             {feedback.telephone || 'N/A'}
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiMessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Feedback Messages</h3>
                  <p className="text-gray-600">No feedback messages found for {selectedDepartmentForFeedback.name}.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <FiAward className="w-6 h-6 text-blue-600" />
                  Department Performance Rankings
                </h2>
                <p className="text-gray-600 mt-1">Sorted by average rating performance</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Feedback Count</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                          <p className="text-gray-500 mt-3">Loading performance data...</p>
                        </td>
                      </tr>
                    ) : departmentRatings.length > 0 ? (
                      departmentRatings.map((dept, index) => (
                        <tr key={dept.department} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                index === 1 ? 'bg-gray-100 text-gray-800' :
                                index === 2 ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-50 text-gray-600'
                              }`}>
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{dept.department}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-gray-900">{dept.average_rating?.toFixed(1) || '0.0'}</span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <FiStar
                                    key={star}
                                    className={`w-4 h-4 ${star <= Math.round(dept.average_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-600">{dept.total_feedback} reviews</span>
                              <button
                                onClick={() => fetchDepartmentFeedback(dept.department, dept.department_id)}
                                disabled={!dept.department_id}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!dept.department_id ? "Department ID missing" : "View messages"}
                              >
                                <FiEye className="w-4 h-4" />
                                View Messages
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                              dept.average_rating >= 4.5 ? 'bg-green-100 text-green-800' :
                              dept.average_rating >= 3.5 ? 'bg-blue-100 text-blue-800' :
                              dept.average_rating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                              dept.average_rating >= 1.5 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {dept.average_rating >= 4.5 ? 'Excellent' :
                               dept.average_rating >= 3.5 ? 'Good' :
                               dept.average_rating >= 2.5 ? 'Average' :
                               dept.average_rating >= 1.5 ? 'Poor' : 'Very Poor'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <FiEye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          No feedback data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiBarChart2 className="w-5 h-5 text-blue-600" />
                Performance Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Excellent (4.5+)</span>
                  <span className="text-lg font-bold text-green-600">{insights.excellent}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">Good (3.5-4.4)</span>
                  <span className="text-lg font-bold text-blue-600">{insights.good}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm font-medium text-yellow-800">Needs Improvement</span>
                  <span className="text-lg font-bold text-yellow-600">{insights.needsImprovement}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiUsers className="w-5 h-5 text-blue-600" />
                Key Insights
              </h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>{departments.length} departments actively receiving feedback</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>{insights.total > 0 ? Math.round((insights.excellent / insights.total) * 100) : 0}% of feedback is rated excellent or above</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Top performing department: {departmentRatings[0]?.department || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FeedbackPage;