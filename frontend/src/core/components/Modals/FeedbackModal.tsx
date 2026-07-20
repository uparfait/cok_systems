// FeedbackModal - Multi-step feedback form for visitors
// Choice: Service Provided → phone → department → rate → preview → submit
// Choice: Custom Feedback (No Service) → rate → preview → submit

import React, { useState, useEffect } from 'react';
import { FiX, FiPhone, FiCheckCircle, FiAlertCircle, FiStar, FiMessageSquare, FiEye, FiUsers, FiUser } from 'react-icons/fi';
import { verifyPhone, submitFeedback, submitUnservicedFeedback, getFeedbackByPhone } from '../../services/feedbackService';
import { useToast } from '../../contexts/ToastContext';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '14px',
  backgroundColor: NEUTRAL_LIGHT,
  border: '1px solid transparent',
  borderRadius: 0,
  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  color: NEUTRAL_DARK,
};

const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  borderRadius: 0,
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'transparent';
  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
};

interface AssignedDepartment {
  department_id: string;
  department_name: string;
  assigned_time: string;
  reached_in: string;
  provider_name: string;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'choice' | 'phone' | 'department' | 'rate' | 'preview' | 'unserviced_rate' | 'unserviced_preview' | 'success' | 'error';

type FeedbackType = 'serviced' | 'unserviced';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { showSuccess, showError } = useToast();

  // Feedback type selection
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('serviced');

  // Step state - always starts at the choice screen (Service Provided vs General Feedback)
  const [step, setStep] = useState<Step>('choice');
  const [isInitialized, setIsInitialized] = useState(false);

  // Serviced form data
  const [phone, setPhone] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [departments, setDepartments] = useState<AssignedDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<AssignedDepartment | null>(null);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [existingFeedback, setExistingFeedback] = useState<Record<string, { rate: number; department_name: string; department_id: string }>>({});

  // Unserviced form data
  const [unservedName, setUnservedName] = useState('');
  const [unservedPhone, setUnservedPhone] = useState('');
  const [unservedRating, setUnservedRating] = useState(5);
  const [unservedMessage, setUnservedMessage] = useState('');

  // Loading states
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Error state
  const [errorMessage, setErrorMessage] = useState('');

  const resetForm = () => {
    setStep('choice');
    setFeedbackType('serviced');
    setPhone('');
    setVisitorName('');
    setDepartments([]);
    setSelectedDepartment(null);
    setRating(5);
    setMessage('');
    setErrorMessage('');
    setExistingFeedback({});
    setUnservedName('');
    setUnservedPhone('');
    setUnservedRating(5);
    setUnservedMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Reset to choice step whenever the modal opens
  useEffect(() => {
    if (isOpen && !isInitialized) {
      resetForm();
      setIsInitialized(true);
    }
    if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen, isInitialized]);

  const handleSelectServiced = () => {
    setFeedbackType('serviced');
    setStep('phone');
  };

  const handleSelectUnserviced = () => {
    setFeedbackType('unserviced');
    setStep('unserviced_rate');
  };

  // Serviced flow handlers
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
        loadExistingFeedback(phone.trim());
        setStep('department');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as {message?: string}).message) : 'Phone number not found');
      setStep('error');
    } finally {
      setIsVerifying(false);
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
        textmessage: message.trim() || undefined
      });
      setExistingFeedback(prev => ({
        ...prev,
        [selectedDepartment.department_id]: {
          rate: rating,
          department_name: selectedDepartment.department_name,
          department_id: selectedDepartment.department_id
        }
      }));
      setStep('success');
      showSuccess('Thank you! Your feedback has been submitted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as {message?: string}).message) : 'Failed to submit feedback');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadExistingFeedback = async (telephone: string) => {
    try {
      const result = await getFeedbackByPhone(telephone);
      const feedbackMap: Record<string, { rate: number; department_name: string; department_id: string }> = {};
      result.feedback.forEach((fb) => {
        feedbackMap[fb.department_id] = fb;
      });
      setExistingFeedback(feedbackMap);
    } catch {
      setExistingFeedback({});
    }
  };

  const handleGoBack = () => {
    if (step === 'phone') setStep('choice');
    else if (step === 'department') setStep('phone');
    else if (step === 'rate') setStep('department');
    else if (step === 'preview') setStep('rate');
    else if (step === 'error') setStep('phone');
    else if (step === 'unserviced_rate') setStep('choice');
    else if (step === 'unserviced_preview') setStep('unserviced_rate');
  };

  const handleSelectDepartment = (dept: AssignedDepartment) => {
    if (existingFeedback[dept.department_id]) {
      const fb = existingFeedback[dept.department_id];
      setErrorMessage(`Feedback already submitted for ${dept.department_name}. Rating: ${fb.rate}/10. You can only provide feedback once per department.`);
      setStep('error');
      return;
    }
    setSelectedDepartment(dept);
    setStep('rate');
  };

  const handlePreview = () => {
    setStep('preview');
  };

  // Unserviced flow handlers
  const handleUnservicedPreview = () => {
    setStep('unserviced_preview');
  };

  const handleUnservicedSubmit = async () => {
    setIsSubmitting(true);

    try {
      await submitUnservicedFeedback({
        telephone: unservedPhone || undefined,
        user_name: unservedName || undefined,
        rate: unservedRating,
        textmessage: unservedMessage.trim() || undefined
      });
      setStep('success');
      showSuccess('Thank you! Your feedback has been submitted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as {message?: string}).message) : 'Failed to submit feedback');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 backdrop-blur-sm transition-opacity" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md max-h-[85vh] flex flex-col transform bg-white transition-all" style={{ borderRadius: 0, border: `2px solid ${PRIMARY}`, boxShadow: CARD_SHADOW }}>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              <FiMessageSquare className="w-5 h-5" style={{ color: PRIMARY }} />
              {step === 'success' ? 'Feedback Submitted' : 'Submit Feedback'}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" style={{ borderRadius: 0 }}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto">

            {/* Choice Step */}
            {step === 'choice' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>How would you like to submit your feedback?</h3>
                  <p className="text-xs text-gray-500 mt-1">Choose the option that matches your situation</p>
                </div>

                <div className="space-y-3">
                  {/* Service Provided Option */}
                  <button
                    onClick={handleSelectServiced}
                    className="w-full p-5 border-2 transition-all text-left group"
                    style={{ borderRadius: 0, borderColor: 'rgba(5,109,170,0.25)', backgroundColor: NEUTRAL_LIGHT }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(5,109,170,0.25)'; }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderRadius: 0, backgroundColor: 'rgba(5,109,170,0.12)' }}>
                        <FiUsers className="w-6 h-6" style={{ color: PRIMARY }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>I Received a Service</p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          I visited a department and want to rate the service I received.
                          <span className="block mt-1 font-medium" style={{ color: PRIMARY }}>Requires phone verification</span>
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Custom Feedback Option */}
                  <button
                    onClick={handleSelectUnserviced}
                    className="w-full p-5 border-2 transition-all text-left group"
                    style={{ borderRadius: 0, borderColor: 'rgba(205,184,150,0.6)', backgroundColor: NEUTRAL_LIGHT }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = TERTIARY; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(205,184,150,0.6)'; }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderRadius: 0, backgroundColor: 'rgba(205,184,150,0.25)' }}>
                        <FiUser className="w-6 h-6" style={{ color: TERTIARY }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          No service required. Share your experience & suggestion.
                          <span className="block mt-1 font-medium" style={{ color: '#b09468' }}> Skip phone verification, rate and send</span>
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Enter Phone (Serviced) */}
            {step === 'phone' && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <div className="w-12 h-12 bg-[#e6f1f8] rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiPhone className="w-6 h-6 text-[#056daa]" />
                  </div>
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Enter Your Phone Number</p>
                  <p className="text-xs text-gray-500">Use the phone number from your service visit</p>
                </div>

                <div>
                  <label className="block mb-1.5" style={labelStyle}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <FiPhone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full pl-10 pr-4 py-2.5 focus:outline-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
                    />
                  </div>
                </div>

                <button
                  onClick={handleVerifyPhone}
                  disabled={isVerifying || !phone.trim()}
                  className="w-full py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  {isVerifying ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Verifying...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>

                <button
                  onClick={handleGoBack}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>
            )}

            {/* Step 2: Select Department (Serviced) */}
            {step === 'department' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiCheckCircle className="w-6 h-6 text-green-600" />
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
                            <p className="text-xs text-gray-500 mt-0.5">
                              Provider: {dept.provider_name}
                            </p>
                          </div>
                          {hasFeedback && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <FiCheckCircle className="w-3 h-3" />
                              Done
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleGoBack}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>
            )}

            {/* Step 3: Rate & Message (Serviced) */}
            {step === 'rate' && selectedDepartment && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{selectedDepartment.department_name}</p>
                  <p className="text-xs text-gray-500">Rate your experience</p>
                </div>

                {/* Rating */}
                <div>
                  <label className="block mb-2 text-center" style={labelStyle}>
                    Rating: {rating}/10
                  </label>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <button
                        key={value}
                        onClick={() => setRating(value)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
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
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block mb-1.5" style={labelStyle}>
                    Your Feedback (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    placeholder="Tell us about your experience..."
                    rows={3}
                    className="w-full px-3 py-2 focus:outline-none resize-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoBack}
                    className="flex-1 py-2.5 px-4 transition-colors"
                    style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePreview}
                    className="flex-1 py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
                    style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                  >
                    <FiEye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            )}

            {/* Step: Rate & Message (Unserviced) */}
            {step === 'unserviced_rate' && (
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Share Your Feedback</p>
                  <p className="text-xs text-gray-500">No service required - tell us about your experience</p>
                </div>

                {/* Optional Name & Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1" style={labelStyle}>
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={unservedName}
                      onChange={(e) => setUnservedName(e.target.value.slice(0, 200))}
                      placeholder="Enter your name"
                      className="w-full px-3 py-1.5 focus:outline-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}
                    />
                  </div>
                  <div>
                    <label className="block mb-1" style={labelStyle}>
                      Phone (Optional)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <FiPhone className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        value={unservedPhone}
                        onChange={(e) => setUnservedPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full pl-9 pr-3 py-1.5 focus:outline-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}
                      />
                    </div>
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="block mb-1 text-center" style={labelStyle}>
                    Rating: {unservedRating}/10
                  </label>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <button
                        key={value}
                        onClick={() => setUnservedRating(value)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                          value <= unservedRating
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
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-1">
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block mb-1" style={labelStyle}>
                    Your Feedback (Optional)
                  </label>
                  <textarea
                    value={unservedMessage}
                    onChange={(e) => setUnservedMessage(e.target.value.slice(0, 500))}
                    placeholder="Tell us about your experience..."
                    rows={2}
                    className="w-full px-3 py-1.5 focus:outline-none resize-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}
                  />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{unservedMessage.length}/500</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoBack}
                    className="flex-1 py-2 px-4 transition-colors"
                    style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleUnservicedPreview}
                    className="flex-1 py-2 px-4 transition-colors flex items-center justify-center gap-2"
                    style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                  >
                    <FiEye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Preview (Serviced) */}
            {step === 'preview' && selectedDepartment && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-[#e6f1f8] rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiMessageSquare className="w-6 h-6 text-[#056daa]" />
                  </div>
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Preview Your Feedback</p>
                </div>

                <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid #E0E0E0' }}>
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
                      <span className={`text-sm font-bold ${
                        rating <= 3 ? 'text-red-500' : rating <= 5 ? 'text-orange-500' : rating <= 7 ? 'text-yellow-600' : 'text-green-500'
                      }`}>
                        {rating}/10
                      </span>
                      <div className="flex ml-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FiStar
                            key={star}
                            className={`w-3 h-3 ${
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
                    </div>
                  </div>
                  {message && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Message</span>
                      <p className="text-sm text-gray-700 mt-1 italic">"{message}"</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoBack}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors"
                    style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    style={{ ...buttonBaseStyle, backgroundColor: SUCCESS, color: WHITE, border: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d8b40'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Preview (Unserviced) */}
            {step === 'unserviced_preview' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-[#f5eede] rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiMessageSquare className="w-6 h-6 text-[#b09468]" />
                  </div>
                  <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Preview Your Feedback</p>
                </div>

                <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid #E0E0E0' }}>
                  {(unservedName || unservedPhone) && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">From</span>
                      <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                        {unservedName}{unservedName && unservedPhone ? ' | ' : ''}{unservedPhone}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Type</span>
                    <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Rating</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${
                        unservedRating <= 3 ? 'text-red-500' : unservedRating <= 5 ? 'text-orange-500' : unservedRating <= 7 ? 'text-yellow-600' : 'text-green-500'
                      }`}>
                        {unservedRating}/10
                      </span>
                      <div className="flex ml-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FiStar
                            key={star}
                            className={`w-3 h-3 ${
                              star <= Math.ceil(unservedRating / 2)
                                ? unservedRating <= 4
                                  ? 'text-red-400 fill-red-400'
                                  : unservedRating <= 6
                                    ? 'text-orange-400 fill-orange-400'
                                    : 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {unservedMessage && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Message</span>
                      <p className="text-sm text-gray-700 mt-1 italic">"{unservedMessage}"</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoBack}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors"
                    style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleUnservicedSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    style={{ ...buttonBaseStyle, backgroundColor: SUCCESS, color: WHITE, border: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d8b40'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {step === 'success' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <FiCheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Thank You!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your feedback has been submitted successfully.
                  </p>
                  {((feedbackType === 'serviced' && rating <= 5) || (feedbackType === 'unserviced' && unservedRating <= 5)) && (
                    <p className="text-xs text-orange-500 mt-2">
                      A notification has been sent to the management team.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 transition-colors"
                  style={{ ...buttonBaseStyle, backgroundColor: SUCCESS, color: WHITE, border: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d8b40'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                >
                  Done
                </button>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <FiAlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{errorMessage || 'Unable to Submit'}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Note: You can only submit feedback for departments you were assigned to during your visit.
                  </p>
                </div>
                <button
                  onClick={handleGoBack}
                  className="w-full py-2.5 px-4 transition-colors"
                  style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Step Indicator */}
          {!['success', 'error'].includes(step) && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-center gap-1">
                {(() => {
                  if (feedbackType === 'unserviced') {
                    const unservicedSteps = ['choice', 'unserviced_rate', 'unserviced_preview'];
                    const currentIndex = unservicedSteps.indexOf(step);
                    return (
                      <>
                        {[0, 1, 2].map((i) => (
                          <React.Fragment key={`unserviced-${i}`}>
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                i <= currentIndex ? 'w-4' : 'w-1.5'
                              }`}
                              style={{ backgroundColor: i <= currentIndex ? PRIMARY : '#E5E7EB' }}
                            />
                            {i < 2 && <div className="w-2" />}
                          </React.Fragment>
                        ))}
                      </>
                    );
                  } else {
                    const servicedSteps = ['choice', 'phone', 'department', 'rate', 'preview'];
                    const currentIndex = servicedSteps.indexOf(step);
                    return (
                      <>
                        {[0, 1, 2, 3, 4].map((i) => (
                          <React.Fragment key={`serviced-${i}`}>
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                i <= currentIndex ? 'w-4' : 'w-1.5'
                              }`}
                              style={{ backgroundColor: i <= currentIndex ? PRIMARY : '#E5E7EB' }}
                            />
                            {i < 4 && <div className="w-2" />}
                          </React.Fragment>
                        ))}
                      </>
                    );
                  }
                })()}
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-1.5">
                {step === 'choice' && 'Step 1: Choose feedback type'}
                {step === 'phone' && 'Step 2: Verify phone'}
                {step === 'department' && 'Step 3: Select department'}
                {step === 'rate' && 'Step 4: Rate & message'}
                {step === 'preview' && 'Step 5: Preview & submit'}
                {step === 'unserviced_rate' && 'Step 2: Rate & message'}
                {step === 'unserviced_preview' && 'Step 3: Preview & submit'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
