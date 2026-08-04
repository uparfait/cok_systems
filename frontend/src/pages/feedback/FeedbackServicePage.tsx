import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle, FiStar, FiMessageSquare, FiEye, FiPhone } from 'react-icons/fi';
import { verifyPhone, submitFeedback, getFeedbackByPhone } from '../../core/services/feedbackService';
import { useToast } from '../../core/contexts/ToastContext';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#3d8b40";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

interface AssignedDepartment {
  department_id: string;
  department_name: string;
  assigned_time: string;
  reached_in: string;
  provider_name: string;
}

type Step = 'phone' | 'department' | 'rate' | 'preview' | 'success' | 'error';

const getStarFill = (star: number, rating: number) => {
  if (star <= Math.ceil(rating / 2)) {
    if (rating <= 4) return 'text-red-400 fill-red-400';
    if (rating <= 6) return 'text-orange-400 fill-orange-400';
    return 'text-yellow-400 fill-yellow-400';
  }
  return 'text-gray-300';
};

const getRatingColorClass = (rating: number) => {
  if (rating <= 3) return 'text-red-500';
  if (rating <= 5) return 'text-orange-500';
  if (rating <= 7) return 'text-yellow-600';
  return 'text-green-500';
};

const FeedbackServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [phone, setPhone] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [departments, setDepartments] = useState<AssignedDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<AssignedDepartment | null>(null);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [existingFeedback, setExistingFeedback] = useState<Record<string, { rate: number; department_name: string; department_id: string }>>({});

  const [step, setStep] = useState<Step>('phone');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerifyPhone = async () => {
    if (!phone.trim()) {
      showError('Please enter your phone number');
      return;
    }
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const response = await verifyPhone(phone.trim());
      setVisitorName(response.visitor_name);
      setDepartments(response.assigned_departments);
      if (response.assigned_departments.length === 0) {
        setErrorMessage('No departments assigned to this phone number');
        setStep('error');
      } else {
        await loadExistingFeedback(phone.trim());
        setStep('department');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Phone number not found');
      setStep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const loadExistingFeedback = async (telephone: string) => {
    try {
      const result = await getFeedbackByPhone(telephone);
      const feedbackMap: Record<string, { rate: number; department_name: string; department_id: string }> = {};
      result.feedback.forEach((fb) => {
        feedbackMap[fb.department_id] = { rate: fb.rate, department_name: fb.department_name, department_id: fb.department_id };
      });
      setExistingFeedback(feedbackMap);
    } catch {
      setExistingFeedback({});
    }
  };

  const handleSubmit = async () => {
    if (!selectedDepartment) return;
    setIsSubmitting(true);
    try {
      await submitFeedback({
        telephone: phone,
        department_id: selectedDepartment.department_id,
        rate: rating,
        textmessage: message.trim() || undefined,
      });
      setStep('success');
      showSuccess('Thank you! Your feedback has been submitted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit feedback');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'phone') { navigate('/feedback'); return; }
    if (step === 'department') setStep('phone');
    else if (step === 'rate') setStep('department');
    else if (step === 'preview') setStep('rate');
    else if (step === 'error') setStep('phone');
  };

  const handleSelectDepartment = (dept: AssignedDepartment) => {
    if (existingFeedback[dept.department_id]) {
      const fb = existingFeedback[dept.department_id];
      setErrorMessage(`Feedback already submitted for ${dept.department_name}. Rating: ${fb.rate}/10.`);
      setStep('error');
      return;
    }
    setSelectedDepartment(dept);
    setStep('rate');
  };

  const handlePreview = () => setStep('preview');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: '#F7F9FB', paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white p-6 sm:p-8" style={{ backgroundColor: WHITE, borderRadius: 0, border: '2px solid #056daa' }}>
          {/* Step: Phone */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                  <FiPhone className="w-6 h-6" style={{ color: PRIMARY }} />
                </div>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Enter Your Phone Number</p>
                <p className="text-xs text-gray-500">Use the phone number from your service visit</p>
              </div>
              <div>
                <label className="cok-auth-label">Phone Number</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: '#9E9E9E' }}>
                    <FiPhone className="w-5 h-5" />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="cok-auth-input pr-3 py-3 sm:py-4 text-sm sm:text-base"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleVerifyPhone}
                  disabled={isVerifying || !phone.trim()}
                  className="cok-btn-primary py-3 px-4 disabled:opacity-50 flex items-center justify-center gap-2"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  {isVerifying ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Verifying...
                    </>
                  ) : 'Continue'}
                </button>
                <button
                  onClick={() => navigate('/feedback')}
                  className="cok-btn-outlined w-full mt-3 py-3"
                  style={{ backgroundColor: WHITE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PRIMARY;
                    e.currentTarget.style.color = WHITE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WHITE;
                    e.currentTarget.style.color = PRIMARY;
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step: Department */}
          {step === 'department' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}>
                  <FiCheckCircle className="w-6 h-6" style={{ color: SUCCESS }} />
                </div>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Welcome, {visitorName}</p>
                <p className="text-xs text-gray-500">Select a department to rate</p>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {departments.map((dept) => {
                  const hasFeedback = existingFeedback[dept.department_id];
                  return (
                    <button
                      key={dept.department_id}
                      onClick={() => handleSelectDepartment(dept)}
                      disabled={!!hasFeedback}
                      className={`w-full p-3 border transition-all text-left ${hasFeedback ? 'border-green-200 bg-green-50 cursor-not-allowed' : 'border-gray-200 hover:border-[#056daa] hover:bg-[#F7F9FB]'}`}
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-medium ${hasFeedback ? 'text-green-700' : 'text-gray-900'} text-sm`}>{dept.department_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Provider: {dept.provider_name}</p>
                        </div>
                        {hasFeedback && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <FiCheckCircle className="w-3 h-3" /> Done
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="pt-4">
                <button
                  onClick={handleGoBack}
                  className="cok-btn-outlined w-full py-3"
                  style={{ backgroundColor: WHITE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PRIMARY;
                    e.currentTarget.style.color = WHITE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WHITE;
                    e.currentTarget.style.color = PRIMARY;
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step: Rate */}
          {step === 'rate' && selectedDepartment && (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{selectedDepartment.department_name}</p>
                <p className="text-xs text-gray-500">Rate your experience</p>
              </div>
              <div>
                <label className="cok-auth-label">Rating: {rating}/10</label>
                <div className="flex items-center justify-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      onClick={() => setRating(value)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                        value <= rating
                          ? value <= 3
                            ? 'bg-red-500 text-white'
                            : value <= 5
                            ? 'bg-orange-500 text-white'
                            : value <= 7
                            ? 'bg-yellow-500 text-white'
                            : 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                  <span>Poor</span><span>Excellent</span>
                </div>
              </div>
              <div>
                <label className="cok-auth-label">Your Feedback (Optional)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-start pl-3 pt-2.5" style={{ color: '#9E9E9E' }}>
                    <FiMessageSquare className="w-5 h-5" />
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    placeholder="Tell us about your experience..."
                    rows={3}
                    className="cok-auth-input pr-3 py-3 sm:py-4 text-sm sm:text-base resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button
                  onClick={handleGoBack}
                  className="cok-btn-outlined flex-1 py-3"
                  style={{ backgroundColor: WHITE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PRIMARY;
                    e.currentTarget.style.color = WHITE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WHITE;
                    e.currentTarget.style.color = PRIMARY;
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handlePreview}
                  className="cok-btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  style={{ width: 'auto' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  <FiEye className="w-4 h-4" /> Preview
                </button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && selectedDepartment && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                  <FiMessageSquare className="w-6 h-6" style={{ color: PRIMARY }} />
                </div>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Preview Your Feedback</p>
              </div>
              <div className="p-4 space-y-3" style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0' }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Department</span>
                  <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{selectedDepartment.department_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Provider</span>
                  <span className="text-sm text-gray-700">{selectedDepartment.provider_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Rating</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-bold ${getRatingColorClass(rating)}`}>{rating}/10</span>
                    <div className="flex ml-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FiStar key={star} className={`w-3 h-3 ${getStarFill(star, rating)}`} />
                      ))}
                    </div>
                  </div>
                </div>
                {message && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Message</span>
                    <p className="text-sm text-gray-700 mt-1 italic">"{message}"</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button
                  onClick={() => setStep('rate')}
                  disabled={isSubmitting}
                  className="cok-btn-outlined flex-1 py-3"
                  style={{ backgroundColor: WHITE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PRIMARY;
                    e.currentTarget.style.color = WHITE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WHITE;
                    e.currentTarget.style.color = PRIMARY;
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="cok-btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  style={{ backgroundColor: SUCCESS, width: 'auto' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="w-4 h-4" /> Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}>
                <FiCheckCircle className="w-8 h-8" style={{ color: SUCCESS }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Thank You!</p>
                <p className="text-sm text-gray-500 mt-1">Your feedback has been submitted successfully.</p>
              </div>
              <button
                onClick={() => navigate('/feedback')}
                className="cok-btn-primary py-3 px-4"
                style={{ backgroundColor: SUCCESS }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
              >
                Done
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
                <FiAlertCircle className="w-8 h-8" style={{ color: DANGER }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{errorMessage || 'Unable to Submit'}</p>
                <p className="text-xs text-gray-400 mt-2">Note: You can only submit feedback for departments you were assigned to during your visit.</p>
              </div>
              <button
                onClick={handleGoBack}
                className="cok-btn-primary py-3 px-4"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackServicePage;
