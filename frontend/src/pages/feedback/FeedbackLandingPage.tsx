import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiUser, FiArrowRight } from 'react-icons/fi';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

const FeedbackLandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: NEUTRAL_LIGHT, paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
            Share Your Feedback
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            How would you like to submit your feedback?
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/feedback/service')}
            className="w-full p-6 border-2 transition-all text-left group hover:shadow-lg"
            style={{ borderRadius: 0, borderColor: 'rgba(5,109,170,0.25)', backgroundColor: WHITE }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(5,109,170,0.25)'; }}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderRadius: 0, backgroundColor: 'rgba(5,109,170,0.12)' }}>
                <FiUsers className="w-7 h-7" style={{ color: PRIMARY }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>I Received a Service</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  I visited a department and want to rate the service I received.
                  <span className="block mt-1 font-medium" style={{ color: PRIMARY }}>Requires phone verification</span>
                </p>
              </div>
              <FiArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>

          <button
            onClick={() => navigate('/feedback/general')}
            className="w-full p-6 border-2 transition-all text-left group hover:shadow-lg"
            style={{ borderRadius: 0, borderColor: 'rgba(205,184,150,0.6)', backgroundColor: WHITE }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = TERTIARY; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(205,184,150,0.6)'; }}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderRadius: 0, backgroundColor: 'rgba(205,184,150,0.25)' }}>
                <FiUser className="w-7 h-7" style={{ color: TERTIARY }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</p>
                <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                  No service required. Share your experience and suggestions.
                  <span className="block mt-1 font-medium" style={{ color: '#b09468' }}>Skip phone verification, rate and send</span>
                </p>
              </div>
              <FiArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackLandingPage;