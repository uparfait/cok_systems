// FeedbackModal - Multi-step feedback form for visitors
// Step 1: Enter phone → Step 2: Select department → Step 3: Rate & message → Step 4: Preview → Submit

import React, { useState } from 'react';
import { FiX, FiPhone, FiCheckCircle, FiAlertCircle, FiStar, FiMessageSquare, FiEye } from 'react-icons/fi';
import { verifyPhone, submitFeedback } from '../../services/feedbackService';
import { useToast } from '../../contexts/ToastContext';

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

type Step = 'phone' | 'department' | 'rate' | 'preview' | 'success' | 'error';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { showSuccess, showError } = useToast();

  // Step state
  const [step, setStep] = useState<Step>('phone');
  
  // Form data
  const [phone, setPhone] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [departments, setDepartments] = useState<AssignedDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<AssignedDepartment | null>(null);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  
  // Loading states
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Error state
  const [errorMessage, setErrorMessage] = useState('');

  const resetForm = () => {
    setStep('phone');
    setPhone('');
    setVisitorName('');
    setDepartments([]);
    setSelectedDepartment(null);
    setRating(5);
    setMessage('');
    setErrorMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
        setStep('department');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'No service record found for this phone number');
      setStep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectDepartment = (dept: AssignedDepartment) => {
    setSelectedDepartment(dept);
    setStep('rate');
  };

  const handlePreview = () => {
    setStep('preview');
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
      setStep('success');
      showSuccess('Thank you! Your feedback has been submitted successfully.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to submit feedback');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'department') setStep('phone');
    else if (step === 'rate') setStep('department');
    else if (step === 'preview') setStep('rate');
    else if (step === 'error') setStep('phone');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform rounded-2xl bg-white shadow-xl transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiMessageSquare className="w-5 h-5 text-yellow-500" />
              {step === 'success' ? 'Feedback Submitted' : 'Share Your Feedback'}
            </h2>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            
            {/* Step 1: Enter Phone */}
            {step === 'phone' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter the phone number you used during check-in to submit feedback.
                </p>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 tracking-wide uppercase">
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
                    />
                  </div>
                </div>

                <button
                  onClick={handleVerifyPhone}
                  disabled={isVerifying || !phone.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-yellow-500 text-white font-semibold text-sm hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
              </div>
            )}

            {/* Step 2: Select Department */}
            {step === 'department' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiCheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">Welcome, {visitorName}</p>
                  <p className="text-xs text-gray-500">Select a department to rate</p>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {departments.map((dept) => (
                    <button
                      key={dept.department_id}
                      onClick={() => handleSelectDepartment(dept)}
                      className="w-full p-3 rounded-lg border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-left"
                    >
                      <p className="font-medium text-gray-900 text-sm">{dept.department_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Provider: {dept.provider_name}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGoBack}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>
            )}

            {/* Step 3: Rate & Message */}
            {step === 'rate' && selectedDepartment && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">{selectedDepartment.department_name}</p>
                  <p className="text-xs text-gray-500">Rate your experience</p>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 tracking-wide uppercase text-center">
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 tracking-wide uppercase">
                    Your Feedback (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    placeholder="Tell us about your experience..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoBack}
                    className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePreview}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-yellow-500 text-white font-semibold text-sm hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiEye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Preview */}
            {step === 'preview' && selectedDepartment && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FiMessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">Preview Your Feedback</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Department</span>
                    <span className="text-sm font-medium text-gray-900">{selectedDepartment.department_name}</span>
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
                    className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
                  <p className="text-lg font-semibold text-gray-900">Thank You!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your feedback has been submitted successfully.
                  </p>
                  {rating <= 5 && (
                    <p className="text-xs text-orange-500 mt-2">
                      A notification has been sent to the department head.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors"
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
                  <p className="text-lg font-semibold text-gray-900">Unable to Submit</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {errorMessage || 'Something went wrong. Please try again.'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Note: You can only submit feedback for departments you were assigned to during your visit.
                  </p>
                </div>
                <button
                  onClick={handleGoBack}
                  className="w-full py-2.5 px-4 rounded-lg bg-yellow-500 text-white font-semibold text-sm hover:bg-yellow-600 transition-colors"
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
                {['phone', 'department', 'rate', 'preview'].map((s, index) => (
                  <React.Fragment key={s}>
                    <div
                      className={`w-2 h-2 rounded-full transition-colors ${
                        ['phone', 'department', 'rate', 'preview'].indexOf(step) >= index
                          ? 'bg-yellow-500'
                          : 'bg-gray-200'
                      }`}
                    />
                    {index < 3 && <div className={`w-4 h-0.5 ${['phone', 'department', 'rate', 'preview'].indexOf(step) > index ? 'bg-yellow-500' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
