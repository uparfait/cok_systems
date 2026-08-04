import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiPhone, FiStar, FiMessageSquare, FiEye, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { submitUnservicedFeedback } from '../../core/services/feedbackService';
import { useToast } from '../../core/contexts/ToastContext';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#3d8b40";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

type Step = 'rate' | 'preview' | 'success' | 'error';

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

const FeedbackGeneralPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const [unservedName, setUnservedName] = useState('');
  const [unservedPhone, setUnservedPhone] = useState('');
  const [unservedRating, setUnservedRating] = useState(5);
  const [unservedMessage, setUnservedMessage] = useState('');

  const [step, setStep] = useState<Step>('rate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitUnservicedFeedback({
        telephone: unservedPhone || undefined,
        user_name: unservedName || undefined,
        rate: unservedRating,
        textmessage: unservedMessage.trim() || undefined,
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
    navigate('/feedback');
  };

  const handlePreview = () => setStep('preview');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: '#F7F9FB', paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white p-6 sm:p-8" style={{ backgroundColor: WHITE, borderRadius: 0, border: '2px solid #056daa' }}>
          {/* Step: Rate */}
          {step === 'rate' && (
            <div className="space-y-4">
              <div className="text-center mb-5">
                <h1 className="font-semibold">Share Your Feedback </h1>
                </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="cok-auth-label">Name (Optional)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: '#9E9E9E' }}>
                      <FiUser className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={unservedName}
                      onChange={(e) => setUnservedName(e.target.value.slice(0, 200))}
                      placeholder="Enter your name"
                      className="cok-auth-input pr-3 py-3 sm:py-4 text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div>
                  <label className="cok-auth-label">Phone (Optional)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: '#9E9E9E' }}>
                      <FiPhone className="w-5 h-5" />
                    </span>
                    <input
                      type="tel"
                      value={unservedPhone}
                      onChange={(e) => setUnservedPhone(e.target.value)}
                      placeholder="Phone number"
                      className="cok-auth-input pr-3 py-3 sm:py-4 text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="cok-auth-label">Rating: {unservedRating}/10</label>
                <div className="flex items-center justify-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      onClick={() => setUnservedRating(value)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 ${
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
                    value={unservedMessage}
                    onChange={(e) => setUnservedMessage(e.target.value.slice(0, 500))}
                    placeholder="Tell us about your experience..."
                    rows={3}
                    className="cok-auth-input pr-3 py-3 sm:py-4 text-sm sm:text-base resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{unservedMessage.length}/500</p>
              </div>

              <div className="flex flex-col  gap-2 pt-4">

                <button
                  onClick={handlePreview}
                  className="cok-btn-primary flex items-center justify-center gap-2"
                  
                >
                  <FiEye className="w-4 text-white h-4" /> Preview
                </button>
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
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgba(205,184,150,0.25)' }}>
                  <FiMessageSquare className="w-6 h-6" style={{ color: "white" }} />
                </div>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Preview Your Feedback</p>
              </div>
              <div className="p-4 space-y-3" style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0' }}>
                {(unservedName || unservedPhone) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">From</span>
                    <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{unservedName}{unservedName && unservedPhone ? ' | ' : ''}{unservedPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Rating</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-bold ${getRatingColorClass(unservedRating)}`}>{unservedRating}/10</span>
                    <div className="flex ml-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FiStar key={star} className={`w-3 h-3 ${getStarFill(star, unservedRating)}`} />
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
              <div className="w-16 rounded-full h-16 flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}>
                <FiCheckCircle className="w-8 h-8" style={{ color: SUCCESS }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Thank You!</p>
                <p className="text-sm text-gray-500 mt-1">Thank you for sharing your thoughts with us. We will review your comments and use them to improve.</p>
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
              <div className="w-16 rounded-full h-16 flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
                <FiAlertCircle className="w-8 h-8" style={{ color: DANGER }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{errorMessage || 'Unable to Submit'}</p>
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

export default FeedbackGeneralPage;
