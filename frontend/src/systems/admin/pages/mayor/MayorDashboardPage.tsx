import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/contexts/AuthContext';
import MainLayout from '../../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../../core/components/LoadingSpinner';
import type { AppliedFilter, PeriodValue } from '../components/FeedbackFeed';
import MayorDeptServicesSection, { DeptServicesTotals, useDeptServices } from './MayorDeptServicesSection';
import MayorRequestsSection from './MayorRequestsSection';
import MayorRatingSection, { DepartmentSentimentPanel, useRatingData } from './MayorRatingSection';
import MayorActivitySection from './MayorActivitySection';
import MayorOccupancySection from './MayorOccupancySection';

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";

const PERIOD_OPTIONS: Array<{ value: PeriodValue; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const MayorDashboardPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodValue>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [applied, setApplied] = useState<AppliedFilter>({ period: 'month' });
  const [refreshTick, setRefreshTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const deptServices = useDeptServices(applied, refreshTick);
  const rating = useRatingData(applied, refreshTick);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), 10000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (boardRef.current) {
        await boardRef.current.requestFullscreen();
      }
    } catch {
      setIsFullscreen(!!document.fullscreenElement);
    }
  }, []);

  const handlePeriodChange = (value: PeriodValue) => {
    setPeriod(value);
    if (value !== 'range') setApplied({ period: value });
  };

  const handleApplyRange = () => {
    if (!rangeFrom) return;
    setApplied({ period: 'range', from: rangeFrom, to: rangeTo || undefined });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner />
      </div>
    );
  }

  const board = (
    <div
      ref={boardRef}
      className={isFullscreen ? 'overflow-y-auto p-4 sm:p-6' : ''}
      style={{ backgroundColor: isFullscreen ? '#F7F9FB' : undefined, minHeight: isFullscreen ? '100vh' : undefined }}
    >
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit full screen' : 'View in full screen'}
        className="fixed z-40 text-xs font-semibold uppercase cursor-pointer shadow-lg transition-colors"
        style={{
          top: isFullscreen ? 16 : 76,
          right: 16,
          padding: '0.5rem 0.9rem',
          backgroundColor: PRIMARY,
          color: '#FFFFFF',
          border: `1px solid ${PRIMARY}`,
          borderRadius: 0,
          letterSpacing: '1px',
          fontFamily: fontHeading,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
      >
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </button>

      <div className="space-y-3">
        <DeptServicesTotals totals={deptServices.totals} loading={deptServices.loading} />

        <div className="bg-white p-3" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 shrink-0" style={{ fontFamily: fontHeading }}>Period</span>
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodValue)}
              className="cok-auth-input w-full sm:flex-1 text-sm"
              style={{ paddingLeft: '10px', minHeight: '36px' }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {period === 'range' && (
              <>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="cok-auth-input w-full sm:flex-1 text-sm"
                  style={{ paddingLeft: '10px', minHeight: '36px' }}
                />
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="cok-auth-input w-full sm:flex-1 text-sm"
                  style={{ paddingLeft: '10px', minHeight: '36px' }}
                />
                <button
                  onClick={handleApplyRange}
                  disabled={!rangeFrom}
                  className="w-full sm:w-auto px-4 py-2 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
          <MayorDeptServicesSection data={deptServices} />
          <DepartmentSentimentPanel data={rating} />
        </div>

        <MayorRequestsSection applied={applied} refreshTick={refreshTick} />
        <MayorRatingSection applied={applied} data={rating} />
        <MayorActivitySection applied={applied} refreshTick={refreshTick} />
        <MayorOccupancySection applied={applied} refreshTick={refreshTick} />
      </div>
    </div>
  );

  return <MainLayout>{board}</MainLayout>;
};

export default MayorDashboardPage;
