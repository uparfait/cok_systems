import React, { useState, useEffect, useCallback } from 'react';

interface ServiceTimerProps { checkInTime: string | Date; showIcon?: boolean; variant?: 'default' | 'compact' | 'detailed'; onTimeout?: () => void; timeoutMinutes?: number; }
interface TimeBreakdown { days: number; hours: number; minutes: number; seconds: number; totalMinutes: number; isExpired: boolean; }

const calculateTimeBreakdown = (checkInTime: string | Date, timeoutMinutes?: number): TimeBreakdown => {
  const diff = new Date().getTime() - new Date(checkInTime).getTime();
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  return { days, hours: hours % 24, minutes: totalMinutes % 60, seconds: totalSeconds % 60, totalMinutes, isExpired: timeoutMinutes ? totalMinutes >= timeoutMinutes : false };
};

const formatTime = (b: TimeBreakdown, variant: string): string => {
  if (variant === 'compact') { if (b.days > 0) return `${b.days}d ${b.hours}h`; if (b.hours > 0) return `${b.hours}h ${b.minutes}m`; return `${b.minutes}m`; }
  if (variant === 'detailed') { const p = []; if (b.days > 0) p.push(`${b.days}d`); if (b.hours > 0) p.push(`${b.hours}h`); if (b.minutes > 0) p.push(`${b.minutes}m`); if (b.seconds > 0 && b.days === 0 && b.hours === 0) p.push(`${b.seconds}s`); return p.join(' ') || 'Just now'; }
  if (b.days > 0) return `${b.days}d ${b.hours}h ${b.minutes}m`;
  if (b.hours > 0) return `${b.hours}:${b.minutes.toString().padStart(2, '0')}:${b.seconds.toString().padStart(2, '0')}`;
  return `${b.minutes}:${b.seconds.toString().padStart(2, '0')}`;
};

const getTimerColor = (b: TimeBreakdown, timeoutMinutes?: number): string => {
  if (b.isExpired) return 'text-red-600';
  if (timeoutMinutes && b.totalMinutes >= timeoutMinutes * 0.8) return 'text-orange-500';
  if (b.totalMinutes >= 60) return 'text-yellow-600';
  return 'text-green-600';
};

const ServiceTimer: React.FC<ServiceTimerProps> = ({ checkInTime, showIcon = true, variant = 'default', onTimeout, timeoutMinutes }) => {
  const [tb, setTb] = useState<TimeBreakdown>(calculateTimeBreakdown(checkInTime, timeoutMinutes));
  const handleTimeout = useCallback(() => { if (onTimeout && !tb.isExpired) { const n = calculateTimeBreakdown(checkInTime, timeoutMinutes); if (n.isExpired) onTimeout(); } }, [onTimeout, checkInTime, timeoutMinutes, tb.isExpired]);
  useEffect(() => { const i = setInterval(() => { const n = calculateTimeBreakdown(checkInTime, timeoutMinutes); setTb(n); if (timeoutMinutes && n.isExpired && !tb.isExpired) handleTimeout(); }, 1000); return () => clearInterval(i); }, [checkInTime, timeoutMinutes, handleTimeout, tb.isExpired]);
  return <div className={`inline-flex items-center gap-2 ${getTimerColor(tb, timeoutMinutes)}`}>{showIcon && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}<span className="font-mono font-medium">{formatTime(tb, variant)}</span>{variant === 'detailed' && <span className="text-xs opacity-75 ml-1">{tb.isExpired ? '(Over time)' : 'elapsed'}</span>}</div>;
};

export const CompactTimer: React.FC<{ checkInTime: string | Date; timeoutMinutes?: number }> = ({ checkInTime, timeoutMinutes }) => {
  const [timeStr, setTimeStr] = useState(''); const [color, setColor] = useState('');
  useEffect(() => { const update = () => { const b = calculateTimeBreakdown(checkInTime, timeoutMinutes); setTimeStr(formatTime(b, 'compact')); setColor(getTimerColor(b, timeoutMinutes)); }; update(); const i = setInterval(update, 60000); return () => clearInterval(i); }, [checkInTime, timeoutMinutes]);
  return <span className={`font-mono text-sm ${color}`}>{timeStr}</span>;
};

export const TimerWithProgress: React.FC<{ checkInTime: string | Date; timeoutMinutes: number; onTimeout?: () => void }> = ({ checkInTime, timeoutMinutes, onTimeout }) => {
  const [progress, setProgress] = useState(0); const [isExpired, setIsExpired] = useState(false);
  useEffect(() => { const update = () => { const b = calculateTimeBreakdown(checkInTime, timeoutMinutes); setProgress(Math.min((b.totalMinutes / timeoutMinutes) * 100, 100)); setIsExpired(b.isExpired); if (b.isExpired && onTimeout) onTimeout(); }; update(); const i = setInterval(update, 1000); return () => clearInterval(i); }, [checkInTime, timeoutMinutes, onTimeout]);
  const getColor = () => { if (isExpired) return 'bg-red-500'; if (progress >= 80) return 'bg-orange-500'; if (progress >= 50) return 'bg-yellow-500'; return 'bg-green-500'; };
  return <div className="w-full"><div className="flex justify-between text-xs text-gray-600 mb-1"><span>Service Time</span><span>{Math.round(progress)}%</span></div><div className="w-full bg-gray-200 h-2"><div className={`h-2 transition-all duration-1000 ${getColor()}`} style={{ width: `${progress}%` }} /></div></div>;
};

export default ServiceTimer;