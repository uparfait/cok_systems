import { useState } from 'react';
import SpiralLoader from './SpiralLoader';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';

const STATUS_META = {
  Pending:       { color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200' },
  Completed:     { color: 'bg-green-100 text-green-700 border-green-200' },
  Cancelled:     { color: 'bg-red-100 text-red-700 border-red-200' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-xs font-semibold uppercase tracking-wide border whitespace-nowrap ${meta.color}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {status}
    </span>
  );
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  return status !== 'Completed' && status !== 'Cancelled' && new Date(dueDate) < new Date();
}

export default function EventActionsTable({ actions, loading, error, page, setPage, pageSize, pagination, search, setSearch, dateRange, setDateRange, statusFilter, setStatusFilter, anyFilter, setDetailAction, openCancel }) {
  const totalPages = pagination.totalPages;
  const [fromDraft, setFromDraft] = useState(dateRange?.from || '');
  const [toDraft, setToDraft] = useState(dateRange?.to || '');

  const getPageNumbers = () => {
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, page + 2);
    if (page <= 3) end = Math.min(5, totalPages);
    if (page >= totalPages - 2) start = Math.max(1, totalPages - 4);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex-1 min-w-0 w-full">

      <div className="bg-white border px-3 sm:px-4 py-3 mb-4" style={{ borderColor: '#E0E0E0' }}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <input
              type="text"
              placeholder="Search title, person..."
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              className="w-full cok-auth-input pr-3 py-2 text-sm"
              style={{ minHeight: '40px', paddingLeft: '12px' }}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="date"
              title="From date"
              value={fromDraft}
              onChange={e => setFromDraft(e.target.value)}
              className="cok-auth-input text-sm"
              style={{ minHeight: '40px', paddingLeft: '10px', paddingRight: '8px', width: 'auto' }}
            />
            <span className="text-xs" style={{ color: '#9E9E9E', fontFamily: "'Montserrat', sans-serif" }}>to</span>
            <input
              type="date"
              title="To date"
              value={toDraft}
              onChange={e => setToDraft(e.target.value)}
              className="cok-auth-input text-sm"
              style={{ minHeight: '40px', paddingLeft: '10px', paddingRight: '8px', width: 'auto' }}
            />
            <button
              onClick={() => { setDateRange({ from: fromDraft, to: toDraft }); setPage(1); }}
              disabled={!fromDraft && !toDraft}
              className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: 'auto', padding: '0.55rem 1rem' }}
            >
              Apply
            </button>
            {(dateRange?.from || dateRange?.to) && (
              <button
                onClick={() => { setFromDraft(''); setToDraft(''); setDateRange({ from: '', to: '' }); setPage(1); }}
                className="text-xs font-semibold uppercase cursor-pointer hover:underline"
                style={{ color: '#9E9E9E', fontFamily: "'Montserrat', sans-serif", background: 'transparent', border: 0 }}
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="cok-auth-input text-sm cursor-pointer"
            style={{ minHeight: '40px', paddingLeft: '10px', width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {anyFilter && (
            <button
              onClick={() => { setSearch(''); setFromDraft(''); setToDraft(''); setDateRange({ from: '', to: '' }); setStatusFilter('all'); }}
              className="sm:ml-auto text-xs font-semibold uppercase tracking-wide cursor-pointer hover:underline"
              style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif", background: 'transparent', border: 0 }}
            >
              Clear all
            </button>
          )}
        </div>

      </div>

      {loading ? (
        <div className="flex justify-center py-20"><SpiralLoader color="#056daa" /></div>
      ) : error ? (
        <div className="p-6 text-center text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>
          {error}
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white border p-16 text-center" style={{ borderColor: '#E0E0E0' }}>
          <p className="font-medium text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>No actions found</p>
          <p className="text-sm mt-1" style={{ color: '#AAAAAA' }}>Adjust your filters</p>
        </div>
      ) : (
        <div className="bg-white border overflow-x-auto" style={{ borderColor: '#E0E0E0', WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: PRIMARY }}>
                {['Title', 'Assigned Name', 'Assigned Title', 'Assigned Email', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="px-3 py-3 sm:px-4 sm:py-3.5 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action, idx) => (
                <tr key={action._id}
                  onClick={() => setDetailAction(action)}
                  className={`cursor-pointer transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b" style={{ borderColor: '#E0E0E0' }}>
                    <p className="font-semibold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.title}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <p className="font-medium text-sm text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.assignedPerson?.name || '-'}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: '#E0E0E0', color: '#555555' }}>
                    {action.assignedPerson?.role || '-'}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: '#E0E0E0', color: '#555555' }}>
                    {action.assignedPerson?.email || '-'}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue(action.dueDate, action.currentStatus?.status) ? 'text-red-600' : 'text-zinc-600'}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {formatDate(action.dueDate)}
                    </span>
                    {isOverdue(action.dueDate, action.currentStatus?.status) && (
                      <span className="mt-0.5 block bg-red-100 text-red-600 border border-red-200 rounded-none px-1.5 text-[10px] w-fit">Overdue</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <StatusBadge status={action.currentStatus?.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
          <span className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {pagination.totalRecords === 0 ? 'No records' : (
              <>
                <span className="font-medium text-gray-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, pagination.totalRecords)}</span>
                {' '}of <span className="font-medium text-gray-700">{pagination.totalRecords}</span> records
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}
            >
              Back
            </button>
            {getPageNumbers().map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className="min-w-[32px] h-8 px-2 rounded-none text-sm font-medium transition-colors border cursor-pointer"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                  color: n === page ? '#FFFFFF' : '#666666',
                  borderColor: n === page ? PRIMARY : '#E0E0E0',
                }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
