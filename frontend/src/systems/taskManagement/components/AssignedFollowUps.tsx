import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { getEventActions, type EventAction } from '../../../core/services/eventActionService'
import FollowUpDetailModal from './FollowUpDetailModal'
import SpiralLoader from '../../event-managment/components/SpiralLoader'

const PRIMARY = '#056daa'
const BORDER = '#E0E0E0'
const GRAY_DISABLED = '#9E9E9E'
const fontHeading = "'Montserrat', sans-serif"

const STATUS_META: Record<string, { color: string }> = {
  Pending: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200' },
  Completed: { color: 'bg-green-100 text-green-700 border-green-200' },
  Cancelled: { color: 'bg-red-100 text-red-700 border-red-200' },
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_META[status || ''] || { color: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-xs font-semibold uppercase tracking-wide border whitespace-nowrap ${meta.color}`} style={{ fontFamily: fontHeading }}>
      {status}
    </span>
  )
}

function formatDate(date?: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueDate?: string, status?: string) {
  return status !== 'Completed' && status !== 'Cancelled' && !!dueDate && new Date(dueDate) < new Date()
}

const AssignedFollowUps: React.FC = () => {
  const { user } = useAuth()
  const { showError } = useToast()
  const userEmail = user?.email || ''

  const [actions, setActions] = useState<EventAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [fromDraft, setFromDraft] = useState('')
  const [toDraft, setToDraft] = useState('')
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 })
  const [detailAction, setDetailAction] = useState<EventAction | null>(null)

  const fetchActions = useCallback(async (p = 1, silent = false) => {
    if (!userEmail) return
    if (!silent) { setLoading(true); setError(null) }
    try {
      const params: any = { createdByEmail: userEmail, page: p, limit: pageSize }
      if (search) params.search = search
      if (statusFilter !== 'all') params.status = statusFilter
      if (dateRange.from) params.from = dateRange.from
      if (dateRange.to) params.to = dateRange.to
      const res: any = await getEventActions(params)
      if (res?.success) {
        setActions(res.data || [])
        setPagination({ totalPages: res.totalPages || 1, totalRecords: res.totalRecords || 0 })
      }
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Failed to load follow-ups.')
      else showError(e?.message || 'Failed to refresh follow-ups.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userEmail, search, statusFilter, dateRange, showError])

  useEffect(() => { fetchActions(page) }, [page, fetchActions])

  const stats = {
    total: pagination.totalRecords,
    pending: actions.filter(a => a.currentStatus?.status === 'Pending').length,
    inProgress: actions.filter(a => a.currentStatus?.status === 'In Progress').length,
    completed: actions.filter(a => a.currentStatus?.status === 'Completed').length,
  }

  const anyFilter = search || dateRange.from || dateRange.to || statusFilter !== 'all'
  const totalPages = pagination.totalPages

  const getPageNumbers = () => {
    let start = Math.max(1, page - 2)
    let end = Math.min(totalPages, page + 2)
    if (page <= 3) end = Math.min(5, totalPages)
    if (page >= totalPages - 2) start = Math.max(1, totalPages - 4)
    const pages = []
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {[
          { label: 'Total', value: stats.total, text: 'text-zinc-700' },
          { label: 'Pending', value: stats.pending, text: 'text-amber-700' },
          { label: 'In Progress', value: stats.inProgress, text: 'text-blue-700' },
          { label: 'Completed', value: stats.completed, text: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border p-4" style={{ borderColor: BORDER }}>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide" style={{ fontFamily: fontHeading }}>{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.text}`} style={{ fontFamily: fontHeading }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border px-3 sm:px-4 py-3 mb-4" style={{ borderColor: BORDER }}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <input
              type="text"
              placeholder="Search title, person..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
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
            <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>to</span>
            <input
              type="date"
              title="To date"
              value={toDraft}
              onChange={e => setToDraft(e.target.value)}
              className="cok-auth-input text-sm"
              style={{ minHeight: '40px', paddingLeft: '10px', paddingRight: '8px', width: 'auto' }}
            />
            <button
              onClick={() => { setDateRange({ from: fromDraft, to: toDraft }); setPage(1) }}
              disabled={!fromDraft && !toDraft}
              className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: 'auto', padding: '0.55rem 1rem' }}
            >
              Apply
            </button>
            {(dateRange.from || dateRange.to) && (
              <button
                onClick={() => { setFromDraft(''); setToDraft(''); setDateRange({ from: '', to: '' }); setPage(1) }}
                className="text-xs font-semibold uppercase cursor-pointer hover:underline"
                style={{ color: GRAY_DISABLED, fontFamily: fontHeading, background: 'transparent', border: 0 }}
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
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
              onClick={() => { setSearch(''); setFromDraft(''); setToDraft(''); setDateRange({ from: '', to: '' }); setStatusFilter('all'); setPage(1) }}
              className="sm:ml-auto text-xs font-semibold uppercase tracking-wide cursor-pointer hover:underline"
              style={{ color: '#E74C3C', fontFamily: fontHeading, background: 'transparent', border: 0 }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><SpiralLoader color={PRIMARY} /></div>
      ) : error ? (
        <div className="p-6 text-center text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: '#E74C3C', fontFamily: fontHeading }}>
          {error}
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white border p-16 text-center" style={{ borderColor: BORDER }}>
          <p className="font-medium text-sm" style={{ color: '#888888', fontFamily: fontHeading }}>Nothing to show</p>
        </div>
      ) : (
        <div className="bg-white border overflow-x-auto" style={{ borderColor: BORDER, WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: PRIMARY }}>
                {['Title', 'Assigned Name', 'Assigned Title', 'Assigned Email', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="px-3 py-3 sm:px-4 sm:py-3.5 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: fontHeading }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action, idx) => (
                <tr
                  key={action._id}
                  onClick={() => setDetailAction(action)}
                  className={`cursor-pointer transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                >
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b" style={{ borderColor: BORDER }}>
                    <p className="font-semibold text-zinc-900" style={{ fontFamily: fontHeading }}>{action.title}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
                    <p className="font-medium text-sm text-zinc-900" style={{ fontFamily: fontHeading }}>{action.assignedPerson?.name || '-'}</p>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: '#555555' }}>
                    {action.assignedPerson?.role || '-'}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: '#555555' }}>
                    {action.assignedPerson?.email || '-'}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue(action.dueDate, action.currentStatus?.status) ? 'text-red-600' : 'text-zinc-600'}`} style={{ fontFamily: fontHeading }}>
                      {formatDate(action.dueDate)}
                    </span>
                    {isOverdue(action.dueDate, action.currentStatus?.status) && (
                      <span className="mt-0.5 block bg-red-100 text-red-600 border border-red-200 rounded-none px-1.5 text-[10px] w-fit">Overdue</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
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
          <span className="text-xs text-zinc-500" style={{ fontFamily: fontHeading }}>
            {pagination.totalRecords === 0 ? 'No records' : (
              <>
                <span className="font-medium text-gray-700">{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, pagination.totalRecords)}</span>
                {' '}of <span className="font-medium text-gray-700">{pagination.totalRecords}</span> records
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: BORDER, color: '#666666', fontFamily: fontHeading }}
            >
              Back
            </button>
            {getPageNumbers().map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className="min-w-[32px] h-8 px-2 rounded-none text-sm font-medium transition-colors border cursor-pointer"
                style={{
                  fontFamily: fontHeading,
                  backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                  color: n === page ? '#FFFFFF' : '#666666',
                  borderColor: n === page ? PRIMARY : BORDER,
                }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none cursor-pointer"
              style={{ borderColor: BORDER, color: '#666666', fontFamily: fontHeading }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {detailAction && (
        <FollowUpDetailModal
          followup={detailAction}
          allowFullEdit
          onClose={() => { setDetailAction(null); fetchActions(page, true) }}
          onUpdate={() => fetchActions(page, true)}
          onDelete={() => { setDetailAction(null); fetchActions(page, true) }}
        />
      )}
    </div>
  )
}

export default AssignedFollowUps
