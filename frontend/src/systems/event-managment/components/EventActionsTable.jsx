import { FiSearch, FiX, FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiSlash, FiCheckCircle, FiAlertCircle, FiFilter } from 'react-icons/fi';
import SpiralLoader from './SpiralLoader';

const PRIMARY = '#056daa';
const NEUTRAL_LIGHT = '#F7F9FB';
const DANGER = '#E53935';

const STATUS_META = {
  Pending:       { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <span className="text-[10px]">⏳</span> },
  'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <span className="text-[10px]">🔄</span> },
  Completed:     { color: 'bg-green-100 text-green-700 border-green-200', icon: <span className="text-[10px]">✅</span> },
  Cancelled:     { color: 'bg-red-100 text-red-700 border-red-200', icon: <span className="text-[10px]">🚫</span> },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-xs font-medium border ${meta.color}`}>
      {meta.icon}{status}
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

export default function EventActionsTable({ actions, loading, error, page, pageSize, pagination, search, setSearch, dateFilter, setDateFilter, statusFilter, setStatusFilter, selectedEvent, anyFilter, setDetailAction, openCancel, eventNameMap }) {
  const totalPages = pagination.totalPages;

  return (
    <div className="flex-1 min-w-0">

      {/* filters bar */}
      <div className="bg-white border px-4 py-3 mb-4" style={{ borderColor: '#E0E0E0' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-44">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#888888' }} />
            <input
              type="text"
              placeholder="Search title, person…"
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              className="w-full pl-8 pr-3 py-2 text-sm outline-none"
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#888888' }}>
                <FiX className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <FiCalendar className="w-3.5 h-3.5 shrink-0" style={{ color: '#888888' }} />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="py-1.5 px-2 text-sm outline-none"
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} style={{ color: '#888888' }}>
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm outline-none"
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#888888' }} />
          </div>

          {anyFilter && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setStatusFilter('all'); }}
              className="ml-auto text-xs flex items-center gap-1"
              style={{ color: DANGER }}
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
        <div className="bg-white border overflow-x-auto" style={{ borderColor: '#E0E0E0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: PRIMARY }}>
                {['#', 'Title', 'Assigned To', 'Due Date', 'Status', 'Event', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action, idx) => (
                <tr key={action._id} className="border-t transition-colors cursor-pointer" style={{ borderTopColor: '#E0E0E0' }}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888888' }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="font-semibold text-zinc-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.title}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#888888' }}>{action.actionDescription}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-sm text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{action.assignedPerson?.name}</p>
                    <p className="text-xs" style={{ color: '#888888' }}>{action.assignedPerson?.role}</p>
                    <p className="text-xs italic" style={{ color: '#AAAAAA' }}>{action.assignedPerson?.institution}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue(action.dueDate, action.currentStatus?.status) ? 'text-red-600' : 'text-zinc-600'}`}>
                      <FiCalendar className="w-3 h-3" />
                      {formatDate(action.dueDate)}
                    </span>
                    {isOverdue(action.dueDate, action.currentStatus?.status) && (
                      <span className="mt-0.5 block bg-red-100 text-red-600 border border-red-200 rounded-none px-1.5 text-[10px] w-fit">Overdue</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={action.currentStatus?.status} />
                    <p className="text-xs mt-0.5 max-w-[130px] truncate" style={{ color: '#888888' }}>{action.currentStatus?.description}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    {eventNameMap[action.eventSpecialId] ? (
                      <p className="text-sm font-medium truncate" style={{ color: '#333333', fontFamily: "'Montserrat', sans-serif" }} title={eventNameMap[action.eventSpecialId]}>
                        {eventNameMap[action.eventSpecialId]}
                      </p>
                    ) : (
                      <span className="text-xs italic" style={{ color: '#AAAAAA' }}>Loading…</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailAction(action)}
                        title="View details"
                        className="p-1.5 transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY; e.currentTarget.style.backgroundColor = '#E3F2FD'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#888888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      {action.currentStatus?.status !== 'Cancelled' && (
                        <button
                          onClick={() => openCancel(action)}
                          className="px-3 py-1.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors disabled:opacity-60"
                          style={{ backgroundColor: '#C62828', fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#b71c1c'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#C62828'; }}
                          onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                          onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <FiSlash className="w-3.5 h-3.5 inline mr-1" />
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
              onClick={() => {}}
              disabled={page === 1}
              className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
              style={{ borderColor: '#E0E0E0', color: '#666666' }}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => {}}
                className="min-w-[32px] h-8 px-2 rounded-none text-sm font-medium transition-colors border"
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
              onClick={() => {}}
              disabled={page === totalPages}
              className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
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
