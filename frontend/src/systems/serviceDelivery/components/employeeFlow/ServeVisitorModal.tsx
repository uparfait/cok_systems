// ServeVisitorModal - Modal for serving visitors (Timer starts automatically!)
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSquare, FiRefreshCw, FiInfo } from 'react-icons/fi';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-[950px] overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="flex">
          {/* Left Panel - Visitor Information */}
          <div className="w-[300px] bg-[#F7F9FB] p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 bg-[#1E88C8] rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-[#2C3E50] text-[16px] font-semibold">Visitor Information</span>
            </div>

            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">VISITOR NAME</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#DCEFF9] rounded-full flex items-center justify-center"><span className="text-[#1E88C8] text-[12px] font-bold">{getInitials(visitor.name)}</span></div>
                <span className="text-[#2C3E50] text-[14px] font-medium">{visitor.name}</span>
              </div>
            </div>

            
            {visitor.badgeNumber && (
              <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">BADGE NUMBER</label><span className="text-[#2C3E50] text-[13px]">{visitor.badgeNumber}</span></div>
            )}
            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">PHONE NUMBER</label><span className="text-[#2C3E50] text-[13px]">{visitor.email}</span></div>
            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">REQUESTED SERVICE</label><span className="inline-block bg-[#E3F2FD] text-[#1E88C8] text-[12px] px-2 py-1 rounded-[6px]">{visitor.service}</span></div>
            
            <div className="mt-auto">
              <div className="bg-[#EDF3F8] rounded-[12px] p-3 flex items-start gap-2">
                <FiInfo className="w-4 h-4 text-[#1E88C8] mt-0.5 flex-shrink-0" />
                <span className="text-[#2C3E50] text-[12px]">Assigned at {visitor.checkInTime} via {visitor.gate}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Service Session Control */}
          <div className="flex-1 p-7 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-[#2C3E50] text-[20px] font-semibold">Service Session Control</h2>
              <button onClick={handleClose} className="text-[#000] hover:text-gray-600"><FiX className="w-6 h-6" /></button>
            </div>

            <div className="text-center mb-8">
              <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-6">CURRENT DURATION</label>
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1F2D3D]">{formatTime(timer.hours)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">HOURS</span></div><span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1F2D3D]">{formatTime(timer.minutes)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">MINUTES</span></div><span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1E88C8]">{formatTime(timer.seconds)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">SECONDS</span></div>
              </div>

              <div className="flex justify-center gap-3">
                <span className="inline-flex items-center gap-2 bg-[#e8f5e9] border border-[#34a853] text-[#2e7d32] px-5 py-3 rounded-[12px] text-[14px] font-bold tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-[#34a853] animate-pulse"></span>
                  SERVICE IN PROGRESS
                </span>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Session Notes (Optional)</label>
              <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Add service description..." className="w-full h-[100px] border border-[#D9E1EA] rounded-[12px] p-3 text-[13px] resize-none focus:ring-2 focus:ring-[#1E88C8]" />
            </div>

            <div className="flex justify-end items-center pt-4 border-t border-[#E8EAED]">
              <button onClick={handleEndService} className="inline-flex items-center gap-2 bg-[#e53935] text-white px-8 py-3 rounded-[14px] text-[14px] font-bold hover:bg-[#c62828] transition-colors shadow-sm">
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