import { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiSend } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import outgoingService, { type OutgoingDoc } from '../../../core/services/outgoingService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import ExportModal from './ExportModal';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
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
  className="cursor-pointer pt-3 pb-3 hover:shadow-xl hover:bg-gray-100 mb-0.5 hover:border-gray-300 transition-all duration-150 ease-in-out border-b border-gray-200  transition-colors"
  style={{ borderRadius: 0 }}
>
  <div className="px-4 py-3 flex items-center justify-between gap-4">
    
    <div className="flex items-center gap-3 min-w-0 flex-1">
     
      <p 
        className="text-sm font-bold truncate flex-shrink-0 max-w-[140px] sm:max-w-[200px]" 
        style={{ color: '#056daa' }}
      >
        {request.sender?.name || request.sender?.email || 'Unknown Sender'}
      </p>

     
      <p className="text-xs sm:text-sm text-gray-600 truncate flex-1">
        {request.subject || 'No subject'}
      </p>
    </div>

   
    <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline-block">
      {dateStr}
    </span>
  </div>
</div>
  );
};

const OutgoingCard: React.FC<{
  outgoing: OutgoingDoc;
  onClick: () => void;
}> = ({ outgoing, onClick }) => {
  const dateStr = outgoing.date_of_recording
    ? new Date(outgoing.date_of_recording).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '---';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer pt-3 pb-3 hover:shadow-xl hover:bg-gray-100 mb-0.5 hover:border-gray-300 transition-all duration-150 ease-in-out border-b border-gray-200  transition-colors"
      style={{ borderRadius: 0 }}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <p 
            className="text-sm font-bold truncate flex-shrink-0 max-w-[140px] sm:max-w-[200px]" 
            style={{ color: '#056daa' }}
          >
            {outgoing.destination || 'Unknown Destination'}
          </p>
          <p className="text-xs sm:text-sm text-gray-600 truncate flex-1">
            {outgoing.subject || 'No subject'}
          </p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline-block">
          {dateStr}
        </span>
      </div>
    </div>
  );
};

const RangeModal: React.FC<{
  show: boolean;
  onClose: () => void;
  period: 'all' | 'today' | 'week' | 'month' | 'year' | 'range';
  from: string;
  to: string;
  onApply: () => void;
  onPeriodChange: (p: 'all' | 'today' | 'week' | 'month' | 'year' | 'range') => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}> = ({ show, onClose, period, from, to, onApply, onPeriodChange, onFromChange, onToChange }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ backgroundColor: '#056daa', borderRadius: 0 }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Select Range</h3>
          <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Period</label>
            <select value={period} onChange={(e) => onPeriodChange(e.target.value as any)} className="cok-auth-input w-full py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          {period === 'range' && (
            <div className="flex gap-2">
              <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="cok-auth-input flex-1 py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }} />
              <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="cok-auth-input flex-1 py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }} />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="cok-btn-outlined flex-1" style={{ padding: '0.7rem 1.2rem' }}>Cancel</button>
            <button onClick={()=>{onApply();onClose()}} className="cok-btn-primary flex-1" style={{ padding: '0.7rem 1.2rem' }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IncomingCorrespondences: React.FC<{
  onRequestClick: (request: RequestDoc) => void;
  onNewRequest: () => void;
  onExport?: () => void;
  onOutgoingExport?: () => void;
  onOutgoingClick?: (outgoing: OutgoingDoc) => void;
  onNewOutgoing?: () => void;
}> = ({ onRequestClick, onNewRequest, onExport, onOutgoingExport, onOutgoingClick, onNewOutgoing }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as any) || 'all';
  const initialPeriod = (searchParams.get('period') as any) || 'all';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10) || 1;
  const [requests, setRequests] = useState<RequestDoc[]>([]);
  const [outgoings, setOutgoings] = useState<OutgoingDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Pending' | 'Inprogress' | 'Completed' | 'Overdue' | 'Archived' | 'Outgoing'>(initialStatus as 'all' | 'Pending' | 'Inprogress' | 'Completed' | 'Overdue' | 'Archived' | 'Outgoing');
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'range'>(initialPeriod);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [appliedPeriod, setAppliedPeriod] = useState(initialPeriod);
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);
  const [counts, setCounts] = useState({ all: 0, Pending: 0, Completed: 0, Inprogress: 0, Archived: 0, Overdue: 0, Outgoing: 0 });
  const [outgoingTotal, setOutgoingTotal] = useState(0);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [statusLoading, setStatusLoading] = useState(false);
  const limit = 20;

  const fetchCounts = useCallback(async () => {
    try {
      const res = await requestService.getStatistics({ period: 'all' });
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        const data = res.data as any;
        data.Outgoing = data.outgoing_total;
        
        setCounts({
          all: data.total || 0,
          Pending: data.Pending || 0,
          Completed: data.Completed || 0,
          Inprogress: data.Inprogress || 0,
          Archived: data.Archived || 0,
          Overdue: data.Overdue || 0,
          Outgoing:  data.Outgoing || 0,
        });
      }
    } catch (error) {
      
    }
  }, []);

  const fetchOutgoingCounts = useCallback(async () => {
    try {
      const res = await outgoingService.getTotal({
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
      });
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        const data = res.data as any;
        setOutgoingTotal(data.total || 0);
      }
    } catch (error) {
      // keep existing counts on error
    }
  }, [appliedPeriod, appliedFrom, appliedTo]);

  const silentFetchRequests = useCallback(async () => {
    try {
      const res = await requestService.getAll({
        status: statusFromFilter(activeFilter),
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page,
        limit,
        q: searchInput || undefined,
      });
      let data: RequestDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setRequests(data);
      if ((res as any)?.total !== undefined) {
        setRequestsTotal((res as any).total);
      }
    } catch (error) {
      // keep existing data on error
    }
  }, [activeFilter, appliedPeriod, appliedFrom, appliedTo, page, limit, searchInput]);

  const fetchOutgoings = useCallback(async (q = '', p = 1) => {
    setLoading(true);
    try {
      const res = await outgoingService.getAll({
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page: p,
        limit,
        q: q || undefined,
      });
      let data: OutgoingDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setOutgoings(data);
      if ((res as any)?.total !== undefined) {
        setOutgoingTotal((res as any).total);
      }
    } catch (error) {
      setOutgoings([]);
    } finally {
      setLoading(false);
    }
  }, [appliedPeriod, appliedFrom, appliedTo, limit]);

  const silentFetchOutgoings = useCallback(async () => {
    try {
      const res = await outgoingService.getAll({
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page,
        limit,
        q: searchInput || undefined,
      });
      let data: OutgoingDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setOutgoings(data);
      if ((res as any)?.total !== undefined) {
        setOutgoingTotal((res as any).total);
      }
    } catch (error) {
      // keep existing data on error
    }
  }, [appliedPeriod, appliedFrom, appliedTo, page, limit, searchInput]);

  useEffect(() => {
    if (activeFilter === 'Outgoing') {
      const interval = setInterval(() => {
        silentFetchOutgoings();
        fetchOutgoingCounts();
      }, 5000);
      return () => clearInterval(interval);
    } else {
      fetchCounts();
      const interval = setInterval(() => {
        fetchCounts();
        silentFetchRequests();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchCounts, silentFetchRequests, silentFetchOutgoings, fetchOutgoingCounts, activeFilter]);

   const statusFromFilter = (filter: string) => {
    if (filter === 'Pending') return 'Pending';
    if (filter === 'Inprogress') return 'Inprogress';
    if (filter === 'Completed') return 'Completed';
    if (filter === 'Overdue') return 'Overdue';
    if (filter === 'Archived') return 'Archived';
    return undefined;
  };

  const updateUrl = useCallback((filter: string, p: string, f: string, t: string, pg = 1) => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (p !== 'all') params.set('period', p);
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    if (pg > 1) params.set('page', String(pg));
    const qs = params.toString();
    setSearchParams(qs ? `?${qs}` : '', { replace: true });
  }, [setSearchParams]);

  const fetchRequests = useCallback(async (q = '', p = 1, statusFilter?: string) => {
    setLoading(true);
    try {
      fetchCounts();
       const res = await requestService.getAll({
        status: statusFilter || statusFromFilter(activeFilter),
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page: p,
        limit,
        q: q || undefined,
      });
      let data: RequestDoc[] = [];
      if (res && typeof res === 'object') {
        if (Array.isArray((res as any).data)) data = (res as any).data;
        else if (Array.isArray(res)) data = res;
      }
      setRequests(data);
      if ((res as any)?.total !== undefined) {
        setRequestsTotal((res as any).total);
      }
    } catch (error) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [appliedPeriod, appliedFrom, appliedTo, activeFilter]);

  useEffect(() => {
    if (activeFilter === 'Outgoing') {
      fetchOutgoings('', page);
    } else {
      fetchRequests('', page, statusFromFilter(activeFilter));
    }
  }, [fetchRequests, fetchOutgoings, page, activeFilter]);

 

   const handleFilterChange = async (filter: typeof activeFilter) => {
    if (filter === activeFilter) return;
    setStatusLoading(true);
    setActiveFilter(filter);
    setPage(1);
    updateUrl(filter, appliedPeriod, appliedFrom, appliedTo, 1);
    if (filter === 'Outgoing') {
      setRequests([]);
      setOutgoings([]);
      setOutgoingTotal(0);
      fetchOutgoingCounts();
    } else {
      setOutgoings([]);
      setOutgoingTotal(0);
    }
    setTimeout(() => setStatusLoading(false), 300);
  };

  const handleApply = () => {
    setAppliedPeriod(period);
    setAppliedFrom(from);
    setAppliedTo(to);
    setPage(1);
    updateUrl(activeFilter, period, from, to, 1);
  };

  const handleSearch = async () => {
    setPage(1);
    if (activeFilter === 'Outgoing') {
      await fetchOutgoings(searchInput, 1);
    } else {
      await fetchRequests(searchInput, 1);
    }
  };

  const tabs = [
    { key: 'all', label: 'All', count: counts.all, color: '#2563EB' },
    { key: 'Pending', label: 'Pending', count: counts.Pending, color: '#2563EB' },
    { key: 'Inprogress', label: 'In Progress', count: counts.Inprogress, color: '#F39C12' },
    { key: 'Completed', label: 'Completed', count: counts.Completed, color: '#4CAF50' },
    { key: 'Overdue', label: 'Overdue', count: counts.Overdue, color: '#E53935' },
    { key: 'Archived', label: 'Archived', count: counts.Archived, color: '#9E9E9E' },
    { key: 'Outgoing', label: 'Outgoing', count: counts.Outgoing, color: '#056daa' }
  ] as const;

  const totalPages = Math.max(1, Math.ceil(((activeFilter === 'Outgoing' ? outgoingTotal : requestsTotal) || 0) / limit));
  const startIdx = (page - 1) * limit;
  const pageItems = (activeFilter === 'Outgoing' ? outgoings : requests).slice(startIdx, startIdx + limit);

  return (
    <div className="w-full" style={{ backgroundColor: '#F7F9FB', minHeight: '100%' }}>
      <div className="bg-white w-full" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1 p-1">
            <button
              onClick={() => setShowRangeModal(true)}
              className="cok-btn-outlined flex items-center justify-center"
              style={{ width: '50px', height: '50px', padding: 0 }}
              title="Filter by period"
            >
              <FiCalendar className="w-4 h-4" />
            </button>

            <div className="flex flex-1 items-center">
              <input
                type="text"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="cok-auth-input flex-1 py-3 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif", borderRadius: 0 }}
              />
              <button
                onClick={handleSearch}
                className="cok-btn-primary flex items-center justify-center"
                style={{ width: '50px', height: '50px', padding: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                title="Search"
              >
                <FiSearch className="w-4 h-4" />
              </button>
            </div>

            <div className="relative h-full">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="cok-btn-outlined flex items-center justify-center"
                style={{ width: '50px', height: '50px', padding: 0 }}
                title="Actions"
              >
                <FiChevronDown className="w-4 h-4" />
              </button>
              {actionsOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 shadow-lg z-20" style={{ borderRadius: 0 }}>
                  {onNewRequest && (
                    <button
                      onClick={() => { setActionsOpen(false); onNewRequest(); }}
                      className="cok-btn-outlined w-full"
                      style={{ borderRadius: 0, justifyContent: 'flex-start' }}
                    >
                      New Incoming
                    </button>
                  )}
                  {onNewOutgoing && (
                    <button
                      onClick={() => { setActionsOpen(false); onNewOutgoing(); }}
                      className="cok-btn-outlined w-full"
                      style={{ borderRadius: 0, justifyContent: 'flex-start' }}
                    >
                      New Outgoing
                    </button>
                  )}
                  {onExport && (
                    <button
                      onClick={() => { setActionsOpen(false); onExport(); }}
                      className="cok-btn-outlined w-full"
                      style={{ borderRadius: 0, justifyContent: 'flex-start' }}
                    >
                      Incoming Report
                    </button>
                  )}
                  {onOutgoingExport && (
                    <button
                      onClick={() => { setActionsOpen(false); onOutgoingExport(); }}
                      className="cok-btn-outlined w-full"
                      style={{ borderRadius: 0, justifyContent: 'flex-start' }}
                    >
                      Outgoing Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

            <div className="flex justify-between overflow-x-auto" style={{ borderTop: '1px solid #f0f0f0' }}>
              {tabs.map((tab) => {
                const isActive = activeFilter === tab.key;
                const isLoading = statusLoading && isActive;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleFilterChange(tab.key)}
                    className="relative hover:bg-gray-100 min-w-0 flex-1  flex-shrink-0 min-w-[100px] py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer"
                    style={{
                      color: isActive ? tab.color : '#6b7280',
                      borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                      
                    }}
                  >
                  
                     <>
                       <span className="truncate block">{tab.label}</span>
                       <span className="text-[10px] sm:text-xs opacity-75 block">{tab.count}</span>
                     </>
                   
                 </button>
               );
             })}
           </div>

          <div
            className="relative"
            style={{
              minHeight: '320px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <SpiralLoader />
              </div>
            ) : pageItems.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">
                {activeFilter === 'Outgoing' ? 'No outgoing correspondences found' : 'No incoming correspondences found'}
              </div>
            ) : (
              <div>
                {activeFilter === 'Outgoing'
                  ? pageItems.map((outgoing) => (
                      <OutgoingCard key={(outgoing as OutgoingDoc)._id} outgoing={outgoing as OutgoingDoc} onClick={() => onOutgoingClick?.(outgoing as OutgoingDoc)} />
                    ))
                  : pageItems.map((req) => (
                      <RequestCard key={req._id} request={req} onClick={() => onRequestClick(req)} />
                    ))
                }
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #f0f0f0' }}>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
             <div className="flex gap-1">
               <button
                 onClick={() => { const np = Math.max(1, page - 1); setPage(np); }}
                 disabled={page <= 1}
                 className={activeFilter === 'Outgoing' ? 'cok-btn-primary disabled:opacity-50' : 'cok-btn-primary disabled:opacity-50'}
                 style={{ width: 'auto', padding: '0.35rem 0.6rem', borderRadius: 0 }}
               >
                 <FiChevronLeft className="w-4 h-4" />
               </button>
               <button
                 onClick={() => { const np = Math.min(totalPages, page + 1); setPage(np); }}
                 disabled={page >= totalPages}
                 className={activeFilter === 'Outgoing' ? 'cok-btn-primary disabled:opacity-50' : 'cok-btn-primary disabled:opacity-50'}
                 style={{ width: 'auto', padding: '0.35rem 0.6rem', borderRadius: 0 }}
               >
                 <FiChevronRight className="w-4 h-4" />
               </button>
             </div>
          </div>
        </div>
      </div>

      <RangeModal
        show={showRangeModal}
        onClose={() => setShowRangeModal(false)}
        period={period}
        from={from}
        to={to}
        onApply={handleApply}
        onPeriodChange={setPeriod}
        onFromChange={setFrom}
        onToChange={setTo}
      />
    </div>
  );
};

export default IncomingCorrespondences;
