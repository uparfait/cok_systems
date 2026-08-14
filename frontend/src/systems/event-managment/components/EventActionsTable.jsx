import { FiSearch, FiX, FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiSlash, FiCheckCircle, FiAlertCircle, FiFilter } from 'react-icons/fi';
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
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  return status !== 'Completed' && status !== 'Cancelled' && new Date(dueDate) < new Date();
}

export default function EventActionsTable({ actions, loading, error, page, setPage, pageSize, pagination, search, setSearch, dateFilter, setDateFilter, statusFilter, setStatusFilter, selectedEvent, anyFilter, setDetailAction, openCancel, eventNameMap }) {
  const totalPages = pagination.totalPages;

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

      {/* filters bar */}
      <div className="bg-white border px-3 sm:px-4 py-3 mb-4" style={{ borderColor: '#E0E0E0' }}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9E9E9E' }} />
            <input
              type="text"
              placeholder="Search title, person…"
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              className="w-full cok-auth-input pr-8 py-2 text-sm"
              style={{ minHeight: '40px' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#9E9E9E' }}>
                <FiX className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="cok-auth-input text-sm"
              style={{ minHeight: '40px', paddingLeft: '10px', paddingRight: '8px', width: 'auto' }}
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="cursor-pointer" style={{ color: '#9E9E9E' }}>
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none cok-auth-input text-sm pr-8"
              style={{ minHeight: '40px', paddingLeft: '10px', width: 'auto' }}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9E9E9E' }} />
          </div>

          {anyFilter && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setStatusFilter('all'); }}
              className="sm:ml-auto text-xs font-semibold uppercase tracking-wide flex items-center gap-1 cursor-pointer hover:underline"
              style={{ color: DANGER, fontFamily: "'Montserrat', sans-serif" }}
            >
              <FiX className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {selectedEvent && (
          <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: PRIMARY }}>
            <FiFilter className="w-3 h-3" />
            Showing actions for: <strong>{selectedEvent.eventName}</strong>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><SpiralLoader color="#056daa" /></div>
      ) : error ? (
        <div className="p-6 text-center text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>
          {error}
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white border p-16 text-center" style={{ borderColor: '#E0E0E0' }}>
          <FiCheckCircle className="mx-auto mb-3 w-10 h-10" style={{ color: '#CCCCCC' }} />
          <p className="font-medium text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>No actions found</p>
          <p className="text-sm mt-1" style={{ color: '#AAAAAA' }}>Create one or adjust your filters</p>
        </div>
      ) : (
        <div className="bg-white border overflow-x-auto" style={{ borderColor: '#E0E0E0', WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: PRIMARY }}>
                {['#', 'Title', 'Assigned To', 'Due Date', 'Status', 'Event', 'Actions'].map(h => (
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
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-xs font-mono whitespace-nowrap border-b" style={{ color: '#9E9E9E', borderColor: '#E0E0E0' }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <p className="font-semibold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.title}</p>
                    <p className="text-xs mt-0.5 max-w-[280px] truncate" style={{ color: '#9E9E9E' }}>{action.actionDescription}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <p className="font-medium text-sm text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.assignedPerson?.name}</p>
                    <p className="text-xs" style={{ color: '#9E9E9E' }}>{action.assignedPerson?.role}{action.assignedPerson?.institution ? ` · ${action.assignedPerson.institution}` : ''}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue(action.dueDate, action.currentStatus?.status) ? 'text-red-600' : 'text-zinc-600'}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      <FiCalendar className="w-3 h-3" />
                      {formatDate(action.dueDate)}
                    </span>
                    {isOverdue(action.dueDate, action.currentStatus?.status) && (
                      <span className="mt-0.5 block bg-red-100 text-red-600 border border-red-200 rounded-none px-1.5 text-[10px] w-fit">Overdue</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    <StatusBadge status={action.currentStatus?.status} />
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }}>
                    {eventNameMap[action.eventSpecialId] ? (
                      <p className="text-sm font-medium" style={{ color: '#333333', fontFamily: "'Montserrat', sans-serif" }}>
                        {eventNameMap[action.eventSpecialId]}
                      </p>
                    ) : (
                      <span className="text-xs italic" style={{ color: '#9E9E9E' }}>Loading…</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: '#E0E0E0' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailAction(action)}
                        title="View details"
                        className="p-1.5 transition-colors cursor-pointer"
                        style={{ color: '#9E9E9E' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY; e.currentTarget.style.backgroundColor = '#E3F2FD'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9E9E9E'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      {action.currentStatus?.status !== 'Cancelled' && (
                        <button
                          onClick={() => openCancel(action)}
                          className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wider rounded-none transition-colors cursor-pointer"
                          style={{ backgroundColor: DANGER, fontFamily: "'Montserrat', sans-serif" }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                        >
                          <FiSlash className="w-3 h-3 inline mr-1" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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
              className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: '#E0E0E0', color: '#666666' }}
            >
              <FiChevronLeft className="w-4 h-4" />
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
              className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: '#E0E0E0', color: '#666666' }}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
