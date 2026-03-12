// ServiceTimer Component - Visitor service duration timer
// Displays elapsed time since visitor check-in

import React, { useState, useEffect, useCallback } from 'react';

interface ServiceTimerProps {
  checkInTime: string | Date;
  showIcon?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onTimeout?: () => void;
  timeoutMinutes?: number;
}

interface TimeBreakdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  isExpired: boolean;
}

// Calculate time breakdown from check-in time
const calculateTimeBreakdown = (checkInTime: string | Date, timeoutMinutes?: number): TimeBreakdown => {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  const diff = now.getTime() - checkIn.getTime();
  
  // Calculate individual time units
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  
  // Check if expired (exceeded timeout)
  const isExpired = timeoutMinutes ? totalMinutes >= timeoutMinutes : false;
  
  return {
    days,
    hours: hours % 24,
    minutes,
    seconds,
    totalMinutes,
    isExpired,
  };
};

// Format time for display
const formatTime = (breakdown: TimeBreakdown, variant: string): string => {
  const { days, hours, minutes, seconds } = breakdown;
  
  if (variant === 'compact') {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  if (variant === 'detailed') {
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0 && days === 0 && hours === 0) parts.push(`${seconds}s`);
    return parts.join(' ') || 'Just now';
  }
  
  // Default format
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Get color based on duration
const getTimerColor = (breakdown: TimeBreakdown, timeoutMinutes?: number): string => {
  const { totalMinutes, isExpired } = breakdown;
  
  if (isExpired) return 'text-red-600';
  if (timeoutMinutes && totalMinutes >= timeoutMinutes * 0.8) return 'text-orange-500';
  if (totalMinutes >= 60) return 'text-yellow-600';
  return 'text-green-600';
};

const ServiceTimer: React.FC<ServiceTimerProps> = ({
  checkInTime,
  showIcon = true,
  variant = 'default',
  onTimeout,
  timeoutMinutes,
}) => {
  const [timeBreakdown, setTimeBreakdown] = useState<TimeBreakdown>(
    calculateTimeBreakdown(checkInTime, timeoutMinutes)
  );

  const handleTimeout = useCallback(() => {
    if (onTimeout && !timeBreakdown.isExpired) {
      // Check if it just became expired
      const newBreakdown = calculateTimeBreakdown(checkInTime, timeoutMinutes);
      if (newBreakdown.isExpired) {
        onTimeout();
      }
    }
  }, [onTimeout, checkInTime, timeoutMinutes, timeBreakdown.isExpired]);

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      const newBreakdown = calculateTimeBreakdown(checkInTime, timeoutMinutes);
      setTimeBreakdown(newBreakdown);
      
      // Check for timeout
      if (timeoutMinutes && newBreakdown.isExpired && !timeBreakdown.isExpired) {
        handleTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [checkInTime, timeoutMinutes, handleTimeout, timeBreakdown.isExpired]);

  const colorClass = getTimerColor(timeBreakdown, timeoutMinutes);

  return (
    <div className={`inline-flex items-center gap-2 ${colorClass}`}>
      {showIcon && (
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      )}
      <span className="font-mono font-medium">
        {formatTime(timeBreakdown, variant)}
      </span>
      {variant === 'detailed' && (
        <span className="text-xs opacity-75 ml-1">
          {timeBreakdown.isExpired ? '(Over time)' : 'elapsed'}
        </span>
      )}
    </div>
  );
};

// Compact version for table cells
export const CompactTimer: React.FC<{ checkInTime: string | Date; timeoutMinutes?: number }> = ({
  checkInTime,
  timeoutMinutes,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    const update = () => {
      const breakdown = calculateTimeBreakdown(checkInTime, timeoutMinutes);
      setTimeStr(formatTime(breakdown, 'compact'));
      setColor(getTimerColor(breakdown, timeoutMinutes));
    };
    
    update();
    const interval = setInterval(update, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [checkInTime, timeoutMinutes]);

  return (
    <span className={`font-mono text-sm ${color}`}>
      {timeStr}
    </span>
  );
};

// Progress bar version
export const TimerWithProgress: React.FC<{
  checkInTime: string | Date;
  timeoutMinutes: number;
  onTimeout?: () => void;
}> = ({ checkInTime, timeoutMinutes, onTimeout }) => {
  const [progress, setProgress] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const breakdown = calculateTimeBreakdown(checkInTime, timeoutMinutes);
      const newProgress = Math.min((breakdown.totalMinutes / timeoutMinutes) * 100, 100);
      setProgress(newProgress);
      setIsExpired(breakdown.isExpired);
      
      if (breakdown.isExpired && onTimeout) {
        onTimeout();
      }
    };
    
    update();
    const interval = setInterval(update, 1000);
    
    return () => clearInterval(interval);
  }, [checkInTime, timeoutMinutes, onTimeout]);

  const getProgressColor = () => {
    if (isExpired) return 'bg-red-500';
    if (progress >= 80) return 'bg-orange-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Service Time</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-1000 ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ServiceTimer;
