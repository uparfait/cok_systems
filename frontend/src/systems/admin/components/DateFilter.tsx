/**
 * Date Filter Component for Dashboard
 */

import React, { useState } from 'react';

interface DateRange {
  startDate?: string;
  endDate?: string;
}

interface DateFilterProps {
  onFilterChange: (dateRange: DateRange | undefined) => void;
  loading: boolean;
}

// Simple inline SVG components
const FilterSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4h18l-7 8v6l-4 2v-8L3 4z"
    />
  </svg>
);

const CalendarSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
    <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
    <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
    <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
  </svg>
);

export const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange, loading }) => {
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const handlePresetFilter = (filter: 'today' | 'week' | 'month' | 'year') => {
    setActiveFilter(filter);
    onFilterChange(undefined); // handled by service methods
  };

  const handleCustomFilter = () => {
    if (customStartDate && customEndDate) {
      setActiveFilter('custom');
      onFilterChange({
        startDate: new Date(customStartDate).toISOString(),
        endDate: new Date(customEndDate).toISOString()
      });
    }
  };

  return (
    <div className="bg-white shadow-sm border border-[#E0E0E0] p-4 mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterSvg className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-700">Filter by Date:</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['today', 'week', 'month', 'year'].map((filter) => (
            <button
              key={filter}
              onClick={() => handlePresetFilter(filter as 'today' | 'week' | 'month' | 'year')}
              className={`px-3 py-1 text-sm font-semibold uppercase transition-colors ${
                activeFilter === filter
                  ? 'bg-[#056daa] text-white hover:bg-[#045d94]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ letterSpacing: '1px' }}
              disabled={loading}
            >
              {filter === 'today'
                ? 'Today'
                : filter === 'week'
                ? 'This Week'
                : filter === 'month'
                ? 'This Month'
                : 'This Year'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <CalendarSvg className="w-4 h-4 text-gray-600" />
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="cok-auth-input text-sm"
            style={{ paddingLeft: '10px', minHeight: '34px' }}
            disabled={loading}
          />
          <span className="text-gray-600">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="cok-auth-input text-sm"
            style={{ paddingLeft: '10px', minHeight: '34px' }}
            disabled={loading}
          />
          <button
            onClick={handleCustomFilter}
            className={`px-3 py-1 text-sm font-semibold uppercase transition-colors ${
              activeFilter === 'custom'
                ? 'bg-[#056daa] text-white hover:bg-[#045d94]'
                : 'bg-[#056daa] text-white hover:bg-[#045d94]'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ letterSpacing: '1px' }}
            disabled={loading || !customStartDate || !customEndDate}
          >
            Apply Range
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-[#056daa]">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#056daa]"></div>
            <span className="text-sm">Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
};
