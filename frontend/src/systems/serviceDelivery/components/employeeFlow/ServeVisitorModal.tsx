// ServeVisitorModal - Modal for serving visitors (Timer starts automatically!)
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSquare, FiRefreshCw, FiInfo } from 'react-icons/fi';

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY
};

export interface SelectedVisitor {
  name: string;
  id: string;
  visitorId?: string;
  badgeNumber?: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
  status?: string;
  serviceStartTime?: string;
  departmentName?: string;
}

export interface ServeVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: SelectedVisitor | null;
  onServiceEnd?: (data: { duration: string; startTime: string; endTime: string; notes: string; }) => void;
  onServiceStart?: (startTime: string) => void; // Added missing prop for your logic
}

const ServeVisitorModal: React.FC<ServeVisitorModalProps> = ({
  isOpen, onClose, visitor, onServiceEnd, onServiceStart
}) => {
  const [sessionNotes, setSessionNotes] = useState('');
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Added missing state variables from your code
  const [serviceStarted, setServiceStarted] = useState(false);
  const [serviceEnded, setServiceEnded] = useState(false);
  const [serviceStartTime, setServiceStartTime] = useState('');
  const [serviceEndTime, setServiceEndTime] = useState('');

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  // YOUR LOGIC: Function to start the service timer manually
  const handleStartService = () => {
    setServiceStarted(true);
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setServiceStartTime(timeString);
    onServiceStart?.(timeString);

    // Start manual timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        let { hours, minutes, seconds } = prev;
        seconds++;
        if (seconds >= 60) {
          seconds = 0;
          minutes++;
        }
        if (minutes >= 60) {
          minutes = 0;
          hours++;
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
  };

  // COMBINED LOGIC: Sync timer from backend start time
  useEffect(() => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isOpen && visitor) {
      // 1. Reset states
      setServiceStarted(false);
      setServiceEnded(false);
      setSessionNotes('');
      setTimer({ hours: 0, minutes: 0, seconds: 0 });
      setServiceStartTime('');
      setServiceEndTime('');

      // 2. If visitor has a serviceStartTime from backend, sync to it
      if (visitor.serviceStartTime) {
        setServiceStarted(true);
        const start = new Date(visitor.serviceStartTime).getTime();
        setServiceStartTime(visitor.serviceStartTime);

        if (!isNaN(start)) {
          const syncTimer = () => {
            const now = new Date().getTime();
            const elapsed = Math.max(0, Math.floor((now - start) / 1000));
            setTimer({
              hours: Math.floor(elapsed / 3600),
              minutes: Math.floor((elapsed % 3600) / 60),
              seconds: elapsed % 60
            });
          };

          syncTimer(); // Initial sync
          timerRef.current = setInterval(syncTimer, 1000); // Live sync
        }
      } else {
        // No start time - auto-start (rare case)
        handleStartService();
      }
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, visitor]);

  const handleEndService = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const now = new Date();
    const endTimeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const duration = `${formatTime(timer.hours)}:${formatTime(timer.minutes)}:${formatTime(timer.seconds)}`;

    onServiceEnd?.({
      duration,
      startTime: visitor?.serviceStartTime || serviceStartTime || '', // Fallback added
      endTime: endTimeString,
      notes: sessionNotes
    });
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  if (!isOpen || !visitor) return null;

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[950px] overflow-hidden" style={{ maxHeight: '90vh', boxShadow: CARD_SHADOW }}>
        <div className="flex">
          {/* Left Panel - Visitor Information */}
          <div className="w-[300px] p-6 flex flex-col" style={{ backgroundColor: NEUTRAL_LIGHT }}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: PRIMARY }}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-[16px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Visitor Information</span>
            </div>

            <div className="mb-6"><label className="block mb-2" style={labelStyle}>VISITOR NAME</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}><span className="text-[12px] font-bold" style={{ color: PRIMARY }}>{getInitials(visitor.name)}</span></div>
                <span className="text-[14px] font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.name}</span>
              </div>
            </div>


            {visitor.badgeNumber && (
              <div className="mb-6"><label className="block mb-2" style={labelStyle}>BADGE NUMBER</label><span className="text-[13px]" style={{ color: NEUTRAL_DARK }}>{visitor.badgeNumber}</span></div>
            )}
            <div className="mb-6"><label className="block mb-2" style={labelStyle}>PHONE NUMBER</label><span className="text-[13px]" style={{ color: NEUTRAL_DARK }}>{visitor.email}</span></div>
            <div className="mb-6"><label className="block mb-2" style={labelStyle}>REQUESTED SERVICE</label><span className="inline-block text-[12px] px-2 py-1" style={{ backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY }}>{visitor.service}</span></div>

            <div className="mt-auto">
              <div className="bg-white p-3 flex items-start gap-2" style={{ border: `1px solid ${BORDER}` }}>
                <FiInfo className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: PRIMARY }} />
                <span className="text-[12px]" style={{ color: NEUTRAL_DARK }}>Assigned at {visitor.checkInTime} via {visitor.gate}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Service Session Control */}
          <div className="flex-1 p-7 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-[20px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Session Control</h2>
              <button onClick={handleClose} className="text-[#333333] hover:text-gray-600"><FiX className="w-6 h-6" /></button>
            </div>

            <div className="text-center mb-8">
              <label className="block mb-6" style={labelStyle}>CURRENT DURATION</label>
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}><span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{formatTime(timer.hours)}</span></div><span className="text-[11px] mt-2" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', color: TERTIARY }}>HOURS</span></div><span className="text-[40px] font-bold mt-[-20px]" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}><span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{formatTime(timer.minutes)}</span></div><span className="text-[11px] mt-2" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', color: TERTIARY }}>MINUTES</span></div><span className="text-[40px] font-bold mt-[-20px]" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}><span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: PRIMARY }}>{formatTime(timer.seconds)}</span></div><span className="text-[11px] mt-2" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', color: TERTIARY }}>SECONDS</span></div>
              </div>

              <div className="flex justify-center gap-3">
                <span className="inline-flex items-center gap-2 px-5 py-3 text-[14px] font-bold tracking-wide" style={{ fontFamily: fontHeading, backgroundColor: 'rgba(76,175,80,0.1)', border: `1px solid ${SUCCESS}`, color: SUCCESS_HOVER }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: SUCCESS }}></span>
                  SERVICE IN PROGRESS
                </span>
              </div>
            </div>

            <div className="mb-8">
              <label className="block mb-2" style={labelStyle}>Session Notes (Optional)</label>
              <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Add service description..." className="w-full h-[100px] p-3 resize-none focus:outline-none" style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }} onFocus={(e) => { e.currentTarget.style.border = `1px solid ${PRIMARY}`; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }} onBlur={(e) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
            </div>

            <div className="flex justify-end items-center pt-4 border-t" style={{ borderColor: BORDER }}>
              <button onClick={handleEndService} className="inline-flex items-center gap-2 text-white px-8 py-3 text-[13px] uppercase transition-colors" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', backgroundColor: DANGER, borderRadius: 0 }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}>
                <FiSquare className="w-4 h-4 fill-current" /> End Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServeVisitorModal;