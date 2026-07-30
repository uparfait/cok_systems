import { useState, useEffect, useCallback } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const ALL_FIELDS = [
  { key: 'redaction_date', label: 'Redaction Date' },
  { key: 'reference_number', label: 'Reference Number' },
  { key: 'reception_date', label: 'Reception Date' },
  { key: 'sender', label: 'Sender' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'subject', label: 'Subject' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'remarks', label: 'Remarks' },
];

const RequestCard: React.FC<{
  request: RequestDoc;
  onClick: () => void;
}> = ({ request, onClick }) => {
  const dateStr = request.redaction_date
    ? new Date(request.redaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors"
      style={{ borderRadius: 0 }}
    >
      <div className="px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: '#333333' }}>
              {request.sender?.name || request.sender?.email || 'Unknown Sender'}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 truncate mt-0.5">
              {request.subject || 'No subject'}
            </p>
          </div>
          <span className="text-xs text-gray-400 sm:text-right flex-shrink-0">
            {dateStr}
          </span>
        </div>
      </div>
    </div>
  );
};

const IncomingCorrespondences: React.FC<{
  onRequestClick: (request: RequestDoc) => void;
  onNewRequest: () => void;
}> = ({ onRequestClick, onNewRequest }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<RequestDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Pending' | 'Completed' | 'Overdue' | 'Archived'>('all');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'range' | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedPeriod, setAppliedPeriod] = useState(period);
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [counts, setCounts] = useState({ all: 0, Pending: 0, Completed: 0, Inprogress: 0, Archived: 0 });

  const statusFromFilter = (filter: string) => {
    if (filter === 'Pending') return 'Pending';
    if (filter === 'Completed') return 'Completed';
    if (filter === 'Overdue') return 'Inprogress';
    if (filter === 'Archived') return 'Archived';
    return undefined;
  };

  const fetchRequests = useCallback(async (statusFilter?: string, limit = 100) => {
    setLoading(true);
    try {
      const res = await requestService.getAll({
        status: statusFilter || 'all',
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page: 1,
        limit,
      });

      let data: RequestDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setRequests(data);
    } catch (error) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [appliedPeriod, appliedFrom, appliedTo]);

  const updateUrl = useCallback((filter: string, p: string, f: string, t: string) => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (p !== 'all') params.set('period', p);
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const qs = params.toString();
    setSearchParams(qs ? `?${qs}` : '', { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const initialStatus = (searchParams.get('status') as any) || 'all';
    const initialPeriod = (searchParams.get('period') as any) || 'all';
    const initialFrom = searchParams.get('from') || '';
    const initialTo = searchParams.get('to') || '';
    setActiveFilter(initialStatus);
    setPeriod(initialPeriod);
    setFrom(initialFrom);
    setTo(initialTo);
    setAppliedPeriod(initialPeriod);
    setAppliedFrom(initialFrom);
    setAppliedTo(initialTo);
  }, [searchParams]);

  useEffect(() => {
    fetchRequests(statusFromFilter(activeFilter));
    const interval = setInterval(() => {
      const targets = ['all', 'Pending', 'Completed', 'Inprogress', 'Archived'] as const;
      let changed = false;
      const next = { ...counts };
      (async () => {
        for (const s of targets) {
          const res = await requestService.getAll({ status: s === 'all' ? undefined : s, limit: 1 });
          let data: RequestDoc[] = [];
          if (res && typeof res === 'object') {
            if (Array.isArray((res as any).data)) data = (res as any).data;
            else if (Array.isArray(res)) data = res;
          }
          const total = (res as any)?.total ?? (Array.isArray(res) ? res.length : data.length);
          if (next[s] !== total) {
            next[s] = total;
            changed = true;
          }
        }
        if (changed) setCounts(next);
      })();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests, counts]);

  const handleApply = () => {
    setAppliedPeriod(period);
    setAppliedFrom(from);
    setAppliedTo(to);
    updateUrl(activeFilter, period, from, to);
    fetchRequests(statusFromFilter(activeFilter));
  };

  const handleFilterChange = (filter: typeof activeFilter) => {
    setActiveFilter(filter);
    updateUrl(filter, appliedPeriod, appliedFrom, appliedTo);
  };

  const handleSearch = async () => {
    setSearchTerm(searchInput);
    setSearchLoading(true);
    try {
      const res = await requestService.getAll({
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page: 1,
        limit: 100,
      });
      let data: RequestDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setRequests(data);
    } catch (error) {
      setRequests([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const filteredRequests = searchTerm.trim() ? requests : requests;

  const tabs = [
    { key: 'all', label: 'All', count: counts.all, color: '#2563EB' },
    { key: 'Pending', label: 'Pending', count: counts.Pending, color: '#2563EB' },
    { key: 'Completed', label: 'Completed', count: counts.Completed, color: '#4CAF50' },
    { key: 'Overdue', label: 'Overdue', count: counts.Inprogress, color: '#E53935' },
    { key: 'Archived', label: 'Archived', count: counts.Archived, color: '#9E9E9E' },
  ] as const;

  return (
    <div className="space-y-3" style={{ backgroundColor: '#F7F9FB', minHeight: '100%' }}>
      <div className="flex flex-col gap-3">
        <div className="bg-white overflow-x-auto" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
          <div className="flex items-center gap-4 px-2">
            {tabs.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleFilterChange(tab.key)}
                  className="relative flex-1 min-w-0 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap"
                  style={{
                    color: isActive ? tab.color : '#6b7280',
                    borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                    backgroundColor: isActive ? `${tab.color}10` : 'transparent',
                  }}
                >
                  <span className="truncate block">{tab.label}</span>
                  <span className="text-[10px] sm:text-xs opacity-75 block">{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {period === 'range' && (
            <>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </>
          )}
          <button
            onClick={handleApply}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.6rem 1rem' }}
          >
            Apply
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search sender, subject, reference..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="cok-auth-input w-full py-2.5 px-3 pl-8 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            />
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <button
            onClick={handleSearch}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.6rem 1rem' }}
          >
            Search
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onNewRequest}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.6rem 1rem' }}
          >
            + New Request
          </button>
          <ExportButton />
        </div>
      </div>

      <div
        className="bg-white overflow-hidden"
        style={{
          boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
          borderRadius: 0,
        }}
      >
        {(loading || searchLoading) ? (
          <div className="flex items-center justify-center py-12">
            <SpiralLoader />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            {searchTerm ? 'No results found for your search' : 'No incoming correspondences found'}
          </div>
        ) : (
          <div>
            {filteredRequests.map((req) => (
              <RequestCard
                key={req._id}
                request={req}
                onClick={() => onRequestClick(req)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IncomingCorrespondences;

const SENDER_LAYOUT_OPTIONS = [
  { value: 'combined', label: 'Combined (name + email + telephone)' },
  { value: 'separate', label: 'Separate (name, email, telephone as own columns)' },
];

const ExportButton: React.FC = () => {
  const [showOptions, setShowOptions] = useState(false);
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'range'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fields, setFields] = useState<string[]>(ALL_FIELDS.map(f => f.key));
  const [title, setTitle] = useState('Incoming Correspondences Report');
  const [senderLayout, setSenderLayout] = useState<'combined' | 'separate'>('combined');

  const toggleField = (key: string) => {
    setFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const handleDownload = async () => {
    const url = requestService.getExportUrl({
      period: period === 'all' ? undefined : period,
      from: from || undefined,
      to: to || undefined,
      fields: fields.join(','),
      title,
      senderLayout,
    });
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    setShowOptions(false);
  };

  return (
    <>
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
        style={{ width: 'auto', padding: '0.6rem 1rem', borderRadius: 0, color: '#333333' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>

      {showOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowOptions(false); }}
        >
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-4"
              style={{ backgroundColor: '#056daa', borderRadius: 0 }}
            >
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Export Report
              </h3>
              <button
                onClick={() => setShowOptions(false)}
                className="p-1 text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Report Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {period === 'range' && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="cok-auth-input flex-1 py-2.5 px-3 text-sm"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    />
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="cok-auth-input flex-1 py-2.5 px-3 text-sm"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Sender layout
                </label>
                <div className="flex flex-wrap gap-2">
                  {SENDER_LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSenderLayout(opt.value as any)}
                      className="flex-1 py-2 text-xs sm:text-sm border transition-colors"
                      style={{
                        borderRadius: 0,
                        borderColor: senderLayout === opt.value ? '#056daa' : '#E0E0E0',
                        backgroundColor: senderLayout === opt.value ? 'rgba(5,109,170,0.08)' : '#FFFFFF',
                        color: senderLayout === opt.value ? '#056daa' : '#333333',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Columns to Include
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer border border-gray-200 hover:bg-gray-50 transition-colors"
                      style={{ borderRadius: 0, backgroundColor: fields.includes(field.key) ? '#F7F9FB' : '#FFFFFF' }}
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(field.key)}
                        onChange={() => toggleField(field.key)}
                        className="w-4 h-4"
                        style={{ accentColor: '#056daa' }}
                      />
                      <span className="text-xs sm:text-sm" style={{ color: '#333333' }}>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptions(false)}
                  className="flex-1 py-2.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
                  style={{ borderRadius: 0, color: '#333333' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownload}
                  disabled={fields.length === 0}
                  className="flex-1 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#056daa', borderRadius: 0 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
