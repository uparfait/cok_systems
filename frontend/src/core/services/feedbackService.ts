// Feedback Service - API calls for visitor feedback system

import { get, post } from './apiClient';

// Types (for TypeScript only - not exported to runtime)
interface AssignedDepartment {
  department_id: string;
  department_name: string;
  assigned_time: string;
  reached_in: string;
  provider_name: string;
}

interface VerifyPhoneResponse {
  success: boolean;
  visitor_name: string;
  telephone: string;
  assigned_departments: AssignedDepartment[];
}

interface SubmitFeedbackRequest {
  telephone: string;
  department_id: string;
  rate: number;
  textmessage?: string;
}

interface SubmitFeedbackResponse {
  success: boolean;
  feedback_id: string;
  department_name: string;
  rate: number;
}

interface FeedbackItem {
  _id: string;
  feedback_id?: string;
  department_name: string;
  department_id: string;
  provider_name: string;
  rate: number;
  rate_out_of: number;
  textmessage: string;
  created_date: string;
}

// API Functions

/**
 * Verify phone number and get assigned departments
 * POST /feedback/verify-phone
 */
export const verifyPhone = async (telephone: string): Promise<VerifyPhoneResponse> => {
  const response = await post('/feedback/verify-phone', { telephone });
  if (response.success && response.data) {
    return {
      success: true,
      visitor_name: response.data.visitor_name || '',
      telephone: response.data.telephone || telephone,
      assigned_departments: response.data.assigned_departments || []
    };
  }
  throw new Error(response.error || 'Failed to verify phone');
};

/**
 * Submit feedback for a department
 * POST /feedback/submit
 */
export const submitFeedback = async (data: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse> => {
  const response = await post('/feedback/submit', data);
  if (response.success && response.data) {
    return {
      success: true,
      feedback_id: response.data.feedback_id || '',
      department_name: response.data.department_name || '',
      rate: response.data.rate || data.rate
    };
  }
  throw new Error(response.error || 'Failed to submit feedback');
};

/**
 * Get feedback submitted by a phone number
 * GET /feedback/by-phone/:telephone
 */
export const getFeedbackByPhone = async (telephone: string): Promise<FeedbackItem[]> => {
  const response = await get(`/feedback/by-phone/${telephone}`);
  if (response.success && response.data) {
    return response.data;
  }
  return [];
};

export default {
  verifyPhone,
  submitFeedback,
  getFeedbackByPhone
};
