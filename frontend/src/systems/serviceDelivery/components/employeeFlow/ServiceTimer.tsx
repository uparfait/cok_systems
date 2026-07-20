// ServiceTimer - Reusable timer component for service sessions
import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";

const timerLabelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 600,
  letterSpacing: '1px',
  color: TERTIARY
};

export interface ServiceTimerProps {
  isRunning: boolean;
  onTimerUpdate?: (time: { hours: number; minutes: number; seconds: number }) => void;
  initialTime?: { hours: number; minutes: number; seconds: number };
}

const ServiceTimer: React.FC<ServiceTimerProps> = ({
  isRunning,
  onTimerUpdate,
  initialTime = { hours: 0, minutes: 0, seconds: 0 }
}) => {
  const [time, setTime] = useState(initialTime);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setTime(prev => {
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

        const newTime = { hours, minutes, seconds };
        onTimerUpdate?.(newTime);
        return newTime;
      });
    }, 1000);
  }, [onTimerUpdate]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setTime(initialTime);
    onTimerUpdate?.(initialTime);
  }, [initialTime, onTimerUpdate, stopTimer]);

  // Handle external isRunning prop changes
  useEffect(() => {
    if (isRunning) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, startTimer, stopTimer]);

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Hours */}
      <div className="flex flex-col items-center">
        <div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{formatTime(time.hours)}</span>
        </div>
        <span className="text-[11px] mt-2" style={timerLabelStyle}>HOURS</span>
      </div>

      <span className="text-[40px] font-bold mt-[-20px]" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{formatTime(time.minutes)}</span>
        </div>
        <span className="text-[11px] mt-2" style={timerLabelStyle}>MINUTES</span>
      </div>

      <span className="text-[40px] font-bold mt-[-20px]" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>:</span>

      {/* Seconds */}
      <div className="flex flex-col items-center">
        <div className="w-[90px] h-[90px] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <span className="text-[40px] font-bold" style={{ fontFamily: fontHeading, color: PRIMARY }}>{formatTime(time.seconds)}</span>
        </div>
        <span className="text-[11px] mt-2" style={timerLabelStyle}>SECONDS</span>
      </div>
    </div>
  );
};

// Export a utility function to format time
export const formatTimeValue = (num: number): string => num.toString().padStart(2, '0');

// Export a utility function to format time object to string
export const formatTimeString = (time: { hours: number; minutes: number; seconds: number }): string => {
  return `${formatTimeValue(time.hours)}:${formatTimeValue(time.minutes)}:${formatTimeValue(time.seconds)}`;
};

export default ServiceTimer;
