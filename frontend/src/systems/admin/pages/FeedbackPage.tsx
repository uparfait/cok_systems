// FeedbackPage - Feedback Management Dashboard
// Features: View feedback by department, ratings, statistics

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiStar, FiFilter, FiRefreshCw, FiThumbsUp,
  FiMessageSquare
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

// Types
interface FeedbackItem {
  _id: string;
  department_name?: string;
  rate: number;
  rate_out_of: number;
  comment?: string;
  createdAt?: string;
  visitor_name?: string;
  visitor_phone?: string;
}

interface FeedbackStats {
  total: number;
  by_department: { [key: string]: number };
}

interface DepartmentRating {
  department: string;
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
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [departmentRatings, setDepartmentRatings] = useState<DepartmentRating[]>([]);
  const [overallAverage, setOverallAverage] = useState<{ average_rating: number; total_feedback: number }>({
    average_rating: 0,
    total_feedback: 0
  });
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);

  // Fetch feedback data
  const fetchFeedbackData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch feedback average by department
      const avgRes = await statisticsService.getFeedbackAverageByDepartment();
      const avgData = avgRes?.data?.data || avgRes?.data || null;
      
      if (avgData?.by_department) {
        const deptRatings: DepartmentRating[] = Object.entries(avgData.by_department).map(([dept, data]: [string, any]) => ({
          department: dept,
          average_rating: data.average_rating || 0,
          total_feedback: data.total_feedback || 0,
          average_out_of: data.average_out_of || 5
        }));
        setDepartmentRatings(deptRatings);
        setDepartments(deptRatings.map(d => d.department));
      }

      if (avgData?.overall_average) {
        setOverallAverage(avgData.overall_average);
      }

      // Fetch total feedback
      const totalsRes = await statisticsService.getFeedbackTotals();
      const totalsData = totalsRes?.data || totalsRes || {};
      setTotalFeedback(totalsData?.total || 0);

    } catch (error) {
      console.error('Error fetching feedback data:', error);
      showError('Failed to load feedback data');
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

  // Filter ratings by department
  const filteredRatings = selectedDepartment === 'all' 
    ? departmentRatings 
    : departmentRatings.filter(d => d.department === selectedDepartment);

  // Calculate rating distribution
  const ratingDistribution = departmentRatings.reduce((acc, dept) => {
    if (dept.average_rating >= 4.5) acc.excellent += dept.total_feedback;
    else if (dept.average_rating >= 3.5) acc.good += dept.total_feedback;
    else if (dept.average_rating >= 2.5) acc.average += dept.total_feedback;
    else if (dept.average_rating >= 1.5) acc.poor += dept.total_feedback;
    else acc.veryPoor += dept.total_feedback;
    return acc;
  }, { excellent: 0, good: 0, average: 0, poor: 0, veryPoor: 0 });

  // Radar chart data
  const radarData = departmentRatings.slice(0, 6).map(d => ({
    department: d.department.length > 10 ? d.department.substring(0, 10) + '...' : d.department,
    rating: d.average_rating,
    fullMark: 5
  }));

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FiMessageSquare className="w-8 h-8 text-yellow-500" />
              Feedback Management
            </h1>
            <p className="text-gray-500 mt-1">View and analyze visitor feedback</p>
          </div>
          <button 
            onClick={fetchFeedbackData}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Feedback */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Feedback</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalFeedback}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiMessageSquare className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Average Rating */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Average Rating</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {overallAverage.average_rating?.toFixed(1) || '0.0'}
                    <span className="text-sm text-gray-400">/5</span>
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <FiStar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="flex mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FiStar 
                  key={star} 
                  className={`w-4 h-4 ${star <= Math.round(overallAverage.average_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                />
              ))}
            </div>
          </div>

          {/* Departments */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Departments</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-purple-600 mt-1">{departments.length}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiFilter className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Excellent Ratings */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Excellent (4.5+)</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-green-600 mt-1">{ratingDistribution.excellent}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiThumbsUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Ratings Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Rating by Department</h2>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent"></div>
              </div>
            ) : filteredRatings.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredRatings} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="department"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }}
                      height={80}
                    />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={[0, 5]} />
                    <Tooltip 
                      formatter={(value: any) => [value?.toFixed(2) || '0', 'Rating']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="average_rating" fill="#f59e0b" name="Rating" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No feedback data available
              </div>
            )}
          </div>

          {/* Radar Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
            
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent"></div>
              </div>
            ) : radarData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="department" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Rating"
                      dataKey="rating"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.3}
                    />
                    <Tooltip 
                      formatter={(value: any) => [value?.toFixed(2) || '0', 'Rating']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Department Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Department Performance</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Average Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Feedback</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating Scale</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredRatings.length > 0 ? (
                  filteredRatings.map((dept, index) => (
                    <tr key={dept.department || index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{dept.department}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{dept.average_rating?.toFixed(2) || '0.00'}</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <FiStar 
                                key={star} 
                                className={`w-3 h-3 ${star <= Math.round(dept.average_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                              />
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{dept.total_feedback}</td>
                      <td className="px-4 py-3 text-gray-600">/ {dept.average_out_of || 5}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No feedback data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FeedbackPage;
