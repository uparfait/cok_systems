import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const PRIMARY = '#056daa';
const HOVER = '#045d94';
const NEUTRAL_DARK = '#333333';
const NEUTRAL_LIGHT = '#F7F9FB';
const BORDER = '#E0E0E0';

export default function BookingOptions() {
  const navigate = useNavigate();
  const [trackingId, setTrackingId] = useState('');

  function handleTrack(e) {
    e.preventDefault();
    if (trackingId.trim()) {
      navigate(`/book-a-room/track?code=${encodeURIComponent(trackingId.trim())}`);
    }
  }

  return (
    <>
      <Helmet>
        <title>Booking</title>
        <meta name="description" content="Manage your room booking." />
      </Helmet>

      <main className="w-full min-h-screen flex flex-col items-center px-4 sm:px-6 lg:px-8" style={{ backgroundColor: NEUTRAL_LIGHT, paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="w-full max-w-[1200px] mx-auto">
          
          {/* Header */}
          <div className="text-center mb-10">
            <h1 style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(32px, 5vw, 40px)',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
              color: PRIMARY,
              margin: '0 0 15px 0'
            }}>
              Booking
            </h1>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(15px, 2.5vw, 17px)',
              fontWeight: 400,
              lineHeight: 1.6,
              color: '#555555',
              margin: 0
            }}>
              What would you like to do?
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Track Your Booking Card */}
            <div className="w-full" style={{
              backgroundColor: NEUTRAL_LIGHT,
              boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
              border: '0',
              padding: '40px',
              transition: 'all 0.4s'
            }}>
              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '21px',
                fontWeight: 600,
                color: NEUTRAL_DARK,
                marginTop: 0,
                marginBottom: '20px'
              }}>
                Track Your Booking
              </p>
              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#555555',
                marginBottom: '24px'
              }}>
                Enter your Booking ID to check status.
              </p>

              <form onSubmit={handleTrack}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="Enter your booking id"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: '14px',
                      fontWeight: 500,
                      letterSpacing: '0.2px',
                      padding: '12px 1rem',
                      color: NEUTRAL_DARK,
                      backgroundColor: NEUTRAL_LIGHT,
                      boxSizing: 'border-box',
                      border: '1px solid transparent',
                      borderRadius: 0,
                      boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
                      outline: 'none',
                      flex: 1,
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = PRIMARY;
                      e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: '13px',
                      fontWeight: 600,
                      letterSpacing: '1px',
                      lineHeight: 1.4,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: '#FFFFFF',
                      backgroundColor: PRIMARY,
                      border: 'none',
                      borderRadius: 0,
                      padding: '12px 20px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, transform 0.1s ease',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = HOVER;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = PRIMARY;
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'translateY(1px)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    Track
                  </button>
                </div>
              </form>
            </div>

            {/* New Request Card */}
            <button
              onClick={() => navigate('/book-a-room/new')}
              className="w-full text-left"
              style={{
                backgroundColor: NEUTRAL_LIGHT,
                boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
                border: '0',
                padding: '40px',
                cursor: 'pointer',
                transition: 'all 0.4s',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                target.style.boxShadow = '0 12px 48px 0 rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.boxShadow = '0 8px 40px 0 rgba(0,0,0,0.08)';
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(7,142,206,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                transition: 'background-color 0.2s ease'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="0" ry="0" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>

              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '21px',
                fontWeight: 600,
                color: NEUTRAL_DARK,
                marginTop: 0,
                marginBottom: '15px'
              }}>
                New Request
              </p>
              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#555555',
                marginBottom: '24px'
              }}>
                Reserve a room for your upcoming event or meeting.
              </p>

              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: PRIMARY,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = HOVER;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = PRIMARY;
              }}
              >
                Create Request
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '1px' }}>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </button>

          </div>
        </div>
      </main>
    </>
  );
}
