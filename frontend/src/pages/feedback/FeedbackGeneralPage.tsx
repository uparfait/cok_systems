import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiUser, FiPhone, FiStar, FiMessageSquare, FiEye, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { submitUnservicedFeedback } from '../../core/services/feedbackService';
import { useToast } from '../../core/contexts/ToastContext';

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
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY,
};

const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK,
};

const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', borderRadius: 0,
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'transparent';
  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
};

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
  const { showSuccess, showError } = useToast();

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
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: NEUTRAL_LIGHT, paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleGoBack} className="p-2 hover:bg-gray-100 transition-colors" style={{ borderRadius: 0 }}>
            <FiArrowLeft className="w-5 h-5" style={{ color: PRIMARY }} />
          </button>
          <h1 className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</h1>
        </div>

        <div className="bg-white border border-gray-200 p-4 sm:p-6" style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          {/* Step: Rate */}
          {step === 'rate' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Share Your Feedback</p>
                <p className="text-xs text-gray-500">No service required - tell us about your experience</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1" style={labelStyle}>Name (Optional)</label>
                  <input type="text" value={unservedName} onChange={(e) => setUnservedName(e.target.value.slice(0, 200))} placeholder="Enter your name" className="w-full px-3 py-2 focus:outline-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                </div>
                <div>
                  <label className="block mb-1" style={labelStyle}>Phone (Optional)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><FiPhone className="w-4 h-4" /></span>
                    <input type="tel" value={unservedPhone} onChange={(e) => setUnservedPhone(e.target.value)} placeholder="Phone number" className="w-full pl-9 pr-3 py-2 focus:outline-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-center" style={labelStyle}>Rating: {unservedRating}/10</label>
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button key={value} onClick={() => setUnservedRating(value)} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${value <= unservedRating ? value <= 3 ? 'bg-red-500 text-white' : value <= 5 ? 'bg-orange-500 text-white' : value <= 7 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{value}</button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-1"><span>Poor</span><span>Excellent</span></div>
              </div>

              <div>
                <label className="block mb-1" style={labelStyle}>Your Feedback (Optional)</label>
                <textarea value={unservedMessage} onChange={(e) => setUnservedMessage(e.target.value.slice(0, 500))} placeholder="Tell us about your experience..." rows={3} className="w-full px-3 py-2 focus:outline-none resize-none" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
                <p className="text-xs text-gray-400 mt-1 text-right">{unservedMessage.length}/500</p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleGoBack} className="flex-1 py-2 px-4 transition-colors" style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Back</button>
                <button onClick={handlePreview} className="flex-1 py-2 px-4 transition-colors flex items-center justify-center gap-2" style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>
                  <FiEye className="w-4 h-4" /> Preview
                </button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-[#f5eede] rounded-full flex items-center justify-center mx-auto mb-2">
                  <FiMessageSquare className="w-6 h-6 text-[#b09468]" />
                </div>
                <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Preview Your Feedback</p>
              </div>
              <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid #E0E0E0' }}>
                {(unservedName || unservedPhone) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">From</span>
                    <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{unservedName}{unservedName && unservedPhone ? ' | ' : ''}{unservedPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center"><span className="text-xs text-gray-500 uppercase tracking-wide">Type</span><span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</span></div>
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
                {unservedMessage && (<div><span className="text-xs text-gray-500 uppercase tracking-wide">Message</span><p className="text-sm text-gray-700 mt-1 italic">"{unservedMessage}"</p></div>)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('rate')} disabled={isSubmitting} className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors" style={{ ...buttonBaseStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Edit</button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2.5 px-4 disabled:opacity-50 transition-colors flex items-center justify-center gap-2" style={{ ...buttonBaseStyle, backgroundColor: SUCCESS, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d8b40'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}>
                  {isSubmitting ? (<>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Submitting...
                  </>) : (<>
                    <FiCheckCircle className="w-4 h-4" /> Submit Feedback
                  </>)}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"><FiCheckCircle className="w-8 h-8 text-green-600" /></div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Thank You!</p>
                <p className="text-sm text-gray-500 mt-1">Your feedback has been submitted successfully.</p>
              </div>
              <button onClick={() => navigate('/feedback')} className="w-full py-2.5 px-4 transition-colors" style={{ ...buttonBaseStyle, backgroundColor: SUCCESS, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d8b40'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}>Done</button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><FiX className="w-8 h-8 text-red-600" /></div>
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{errorMessage || 'Unable to Submit'}</p>
              </div>
              <button onClick={handleGoBack} className="w-full py-2.5 px-4 transition-colors" style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackGeneralPage;