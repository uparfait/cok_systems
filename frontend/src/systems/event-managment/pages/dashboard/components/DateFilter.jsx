import { FiCalendar } from 'react-icons/fi';

export default function DateFilter({ dateRange, onChange, onRefresh, loading }) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-none p-3">
      <div className="flex items-center gap-2">
        <FiCalendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Date Range</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="from">From</label>
        <input
          id="from"
          type="date"
          value={dateRange.from}
          onChange={(e) => onChange({ ...dateRange, from: e.target.value })}
          className="h-9 px-3 text-sm border border-gray-300 text-gray-700 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="to">To</label>
        <input
          id="to"
          type="date"
          value={dateRange.to}
          onChange={(e) => onChange({ ...dateRange, to: e.target.value })}
          className="h-9 px-3 text-sm border border-gray-300 text-gray-700 focus:outline-none"
        />
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="max-w-[100px] cok-btn-primary text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
