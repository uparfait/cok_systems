import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/contexts/AuthContext';
import MainLayout from '../../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../../core/components/LoadingSpinner';
import type { AppliedFilter, PeriodValue } from '../components/FeedbackFeed';
import MayorDeptServicesSection from './MayorDeptServicesSection';
import MayorRequestsSection from './MayorRequestsSection';
import MayorRatingSection from './MayorRatingSection';
import MayorActivitySection from './MayorActivitySection';
import MayorOccupancySection from './MayorOccupancySection';

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), 10000);
    return () => window.clearInterval(id);
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

  return (
    <MainLayout>
      <div className="space-y-3">
        <div className="bg-white border border-[#E0E0E0] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
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
                  className="w-full sm:w-auto px-4 py-2 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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

        <MayorDeptServicesSection applied={applied} refreshTick={refreshTick} />
        <MayorRequestsSection applied={applied} refreshTick={refreshTick} />
        <MayorRatingSection applied={applied} refreshTick={refreshTick} />
        <MayorActivitySection applied={applied} refreshTick={refreshTick} />
        <MayorOccupancySection applied={applied} refreshTick={refreshTick} />
      </div>
    </MainLayout>
  );
};

export default MayorDashboardPage;
