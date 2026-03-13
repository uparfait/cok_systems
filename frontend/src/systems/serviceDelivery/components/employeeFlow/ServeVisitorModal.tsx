// ServeVisitorModal - Modal for serving visitors with timer functionality
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiPlay, FiSquare, FiRefreshCw, FiInfo } from 'react-icons/fi';
import ServiceTimer from './ServiceTimer';

export interface SelectedVisitor {
  name: string;
  id: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
}

export interface ServeVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: SelectedVisitor | null;
  onServiceStart?: (startTime: string) => void;
  onServiceEnd?: (data: {
    duration: string;
    startTime: string;
    endTime: string;
    notes: string;
  }) => void;
}

const ServeVisitorModal: React.FC<ServeVisitorModalProps> = ({
  isOpen,
  onClose,
  visitor,
  onServiceStart,
  onServiceEnd,
}) => {
  const [serviceStarted, setServiceStarted] = useState(false);
  const [serviceEnded, setServiceEnded] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [serviceStartTime, setServiceStartTime] = useState<string>('');
  const [serviceEndTime, setServiceEndTime] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  // Reset state when modal opens with new visitor
  useEffect(() => {
    if (isOpen && visitor) {
      setServiceStarted(false);
      setServiceEnded(false);
      setSessionNotes('');
      setTimer({ hours: 0, minutes: 0, seconds: 0 });
      setServiceStartTime('');
      setServiceEndTime('');
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isOpen, visitor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleStartService = () => {
    setServiceStarted(true);
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setServiceStartTime(timeString);
    onServiceStart?.(timeString);
    
    // Start timer
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

  const handleEndService = () => {
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setServiceEnded(true);
    const now = new Date();
    const endTimeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setServiceEndTime(endTimeString);
    
    const duration = `${formatTime(timer.hours)}:${formatTime(timer.minutes)}:${formatTime(timer.seconds)}`;
    
    onServiceEnd?.({
      duration,
      startTime: serviceStartTime,
      endTime: endTimeString,
      notes: sessionNotes
    });
    
    // Show confirmation
    alert(`Service completed!\nDuration: ${duration}\n\nThe head of department has been notified.`);
  };

  const handleClose = () => {
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  };

  const handleTransfer = () => {
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    alert('Transfer functionality - This would transfer the visitor to another employee');
  };

  if (!isOpen || !visitor) return null;

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {/* Modal Container */}
      <div 
        className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-[950px] overflow-hidden"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex">
          {/* Left Panel - Visitor Information */}
          <div className="w-[300px] bg-[#F7F9FB] p-6 flex flex-col">
            {/* Section Title */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 bg-[#1E88C8] rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[#2C3E50] text-[16px] font-semibold">Visitor Information</span>
            </div>

            {/* Visitor Name */}
            <div className="mb-6">
              <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                VISITOR NAME
              </label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#DCEFF9] rounded-full flex items-center justify-center">
                  <span className="text-[#1E88C8] text-[12px] font-bold">
                    {getInitials(visitor.name)}
                  </span>
                </div>
                <span className="text-[#2C3E50] text-[14px] font-medium">
                  {visitor.name}
                </span>
              </div>
            </div>

            {/* Visitor ID */}
            <div className="mb-6">
              <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                VISITOR ID
              </label>
              <span className="text-[#2C3E50] text-[13px]">
                {visitor.id}
              </span>
            </div>

            {/* Email Address */}
            <div className="mb-6">
              <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                EMAIL ADDRESS
              </label>
              <span className="text-[#2C3E50] text-[13px]">
                {visitor.email}
              </span>
            </div>

            {/* Requested Service */}
            <div className="mb-6">
              <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                REQUESTED SERVICE
              </label>
              <span className="inline-block bg-[#E3F2FD] text-[#1E88C8] text-[12px] px-2 py-1 rounded-[6px]">
                {visitor.service}
              </span>
            </div>

            {/* Bottom Info Card */}
            <div className="mt-auto">
              <div className="bg-[#EDF3F8] rounded-[12px] p-3 flex items-start gap-2">
                <FiInfo className="w-4 h-4 text-[#1E88C8] mt-0.5 flex-shrink-0" />
                <span className="text-[#2C3E50] text-[12px]">
                  Visitor checked in at {visitor.checkInTime} via {visitor.gate}
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel - Service Session Control */}
          <div className="flex-1 p-7 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-[#2C3E50] text-[20px] font-semibold">
                Service Session Control
              </h2>
              <button 
                onClick={handleClose}
                className="text-[#000] hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Timer Section */}
            {!serviceEnded && (
              <div className="text-center mb-8">
                <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-6">
                  CURRENT DURATION
                </label>
                
                {/* Timer Display */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  {/* Hours */}
                  <div className="flex flex-col items-center">
                    <div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center">
                      <span className="text-[40px] font-bold text-[#1F2D3D]">
                        {formatTime(timer.hours)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">HOURS</span>
                  </div>

                  <span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>

                  {/* Minutes */}
                  <div className="flex flex-col items-center">
                    <div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center">
                      <span className="text-[40px] font-bold text-[#1F2D3D]">
                        {formatTime(timer.minutes)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">MINUTES</span>
                  </div>

                  <span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>

                  {/* Seconds */}
                  <div className="flex flex-col items-center">
                    <div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center">
                      <span className="text-[40px] font-bold text-[#1E88C8]">
                        {formatTime(timer.seconds)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">SECONDS</span>
                  </div>
                </div>

                {/* Action Buttons */}
                {!serviceStarted ? (
                  <button
                    onClick={handleStartService}
                    className="inline-flex items-center gap-2 bg-[#1E88C8] text-white px-5 py-3 rounded-[12px] text-[14px] font-medium hover:bg-[#1976D2] transition-colors"
                  >
                    <FiPlay className="w-5 h-5" />
                    Service started
                  </button>
                ) : (
                  <button
                    onClick={handleTransfer}
                    className="inline-flex items-center gap-2 bg-transparent border border-[#D0D7E2] text-[#4A5A6A] px-5 py-3 rounded-[12px] text-[14px] font-medium hover:bg-gray-50 transition-colors mr-3"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    Transfer
                  </button>
                )}
              </div>
            )}

            {/* Session Notes */}
            {!serviceEnded && (
              <div className="mb-8">
                <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                  Session Notes
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Enter details about the service provided..."
                  className="w-full h-[100px] border border-[#D9E1EA] rounded-[12px] p-3 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1E88C8] focus:border-transparent"
                />
                <span className="text-[11px] text-[#8A94A6] mt-1 block text-right">Optional</span>
              </div>
            )}

            {/* Bottom Section */}
            <div className="flex justify-between items-center pt-4 border-t border-[#E8EAED]">
              {/* Service Start Time */}
              <div>
                {serviceStarted && !serviceEnded && (
                  <span className="text-[#2C3E50] text-[16px] font-semibold">
                    Service started at {serviceStartTime}
                  </span>
                )}
                {serviceEnded && (
                  <span className="text-[#2C3E50] text-[16px] font-semibold">
                    Service ended at {serviceEndTime}
                  </span>
                )}
                {!serviceStarted && (
                  <span className="text-[#8A94A6] text-[14px]">
                    Service not started
                  </span>
                )}
              </div>

              {/* End Service Button */}
              {serviceStarted && !serviceEnded && (
                <button
                  onClick={handleEndService}
                  className="inline-flex items-center gap-2 bg-[#E53935] text-white px-5 py-3 rounded-[14px] text-[14px] font-medium hover:bg-[#C62828] transition-colors"
                >
                  <FiSquare className="w-4 h-4" />
                  End Service
                </button>
              )}

              {/* Close Button when ended */}
              {serviceEnded && (
                <button
                  onClick={handleClose}
                  className="inline-flex items-center gap-2 bg-[#1E88C8] text-white px-5 py-3 rounded-[14px] text-[14px] font-medium hover:bg-[#1976D2] transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServeVisitorModal;
