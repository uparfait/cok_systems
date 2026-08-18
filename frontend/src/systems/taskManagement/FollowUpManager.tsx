import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { EventAction } from '../../core/services/eventActionService'
import {
  getEventActions,
  updateEventActionStatus,
} from '../../core/services/eventActionService'
import { useAuth } from '../../core/contexts/AuthContext'
import { useToast } from '../../core/contexts/ToastContext'
import FollowUpCard from './components/FollowUpCard'
import FollowUpDetailModal from './components/FollowUpDetailModal'
import CreateFollowUpModal from './components/CreateFollowUpModal'
import AssignedFollowUps from './components/AssignedFollowUps'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_LIGHT = '#F7F9FB'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const fontHeading = "'Montserrat', sans-serif"

const PAGE_SIZE = 20

const FOLLOWUP_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'] as const
type FollowUpStatus = typeof FOLLOWUP_STATUSES[number]

interface ColumnState {
  items: EventAction[]
  page: number
  totalPages: number
  totalRecords: number
  initialLoading: boolean
  loadingMore: boolean
}

interface ColumnDef {
  id: FollowUpStatus
  title: string
  headerColor: string
}

const COLUMN_DEFS: ColumnDef[] = [
  { id: 'Pending',     title: 'Pending',     headerColor: '#6B7280' },
  { id: 'In Progress', title: 'In Progress', headerColor: PRIMARY },
  { id: 'Completed',   title: 'Completed',   headerColor: '#0D9488' },
  { id: 'Cancelled',   title: 'Cancelled',   headerColor: '#E74C3C' },
]

const emptyColumn = (): ColumnState => ({
  items: [],
  page: 0,
  totalPages: 1,
  totalRecords: 0,
  initialLoading: true,
  loadingMore: false,
})

const FollowUpManager: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<FollowUpStatus>('Pending')
  const [viewMode, setViewMode] = useState<'mine' | 'assigned'>('mine')

  const [columns, setColumns] = useState<Record<FollowUpStatus, ColumnState>>({
    'Pending': emptyColumn(),
    'In Progress': emptyColumn(),
    'Completed': emptyColumn(),
    'Cancelled': emptyColumn(),
  })
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const [selectedFollowUp, setSelectedFollowUp] = useState<EventAction | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [draggedFollowUp, setDraggedFollowUp] = useState<EventAction | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  const userEmail = user?.email || ''

  const loadColumnPage = useCallback(async (status: FollowUpStatus, page: number, append: boolean, silent = false) => {
    if (!userEmail) return
    if (!silent) {
      setColumns(prev => ({
        ...prev,
        [status]: {
          ...prev[status],
          initialLoading: !append && page === 1 ? true : prev[status].initialLoading,
          loadingMore: append,
        },
      }))
    }
    try {
      const response: any = await getEventActions({
        status,
        assignedEmail: userEmail,
        page,
        limit: PAGE_SIZE,
      })
      const items: EventAction[] = response?.data || []
      const totalPages = response?.totalPages || 1
      const totalRecords = response?.totalRecords || items.length

      setColumns(prev => {
        const existing = append ? prev[status].items : []
        const seen = new Set(existing.map(i => i._id))
        const merged = [...existing, ...items.filter(i => !seen.has(i._id))]
        return {
          ...prev,
          [status]: {
            items: merged,
            page,
            totalPages,
            totalRecords,
            initialLoading: false,
            loadingMore: false,
          },
        }
      })
    } catch (error: any) {
      showError(error?.message || 'Failed to load follow-ups')
      setColumns(prev => ({
        ...prev,
        [status]: { ...prev[status], initialLoading: false, loadingMore: false },
      }))
    }
  }, [userEmail, showError])

  const reloadAll = useCallback((silent = false) => {
    FOLLOWUP_STATUSES.forEach(status => loadColumnPage(status, 1, false, silent))
  }, [loadColumnPage])

  useEffect(() => { reloadAll() }, [reloadAll])

  const handleColumnScroll = (e: React.UIEvent<HTMLDivElement>, status: FollowUpStatus) => {
    const el = e.currentTarget
    const col = columnsRef.current[status]
    if (col.loadingMore || col.initialLoading) return
    if (col.page >= col.totalPages) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      loadColumnPage(status, col.page + 1, true)
    }
  }

  const handleDragStart = (followup: EventAction) => setDraggedFollowUp(followup)

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(columnId)
  }

  const handleDragLeave = () => setDraggedOverColumn(null)

  const handleDrop = async (e: React.DragEvent, columnId: FollowUpStatus) => {
    e.preventDefault()
    setDraggedOverColumn(null)
    const followup = draggedFollowUp
    setDraggedFollowUp(null)
    if (!followup) return

    const fromStatus = followup.currentStatus?.status as FollowUpStatus
    if (!fromStatus || fromStatus === columnId) return

    const movedItem: EventAction = {
      ...followup,
      currentStatus: { ...followup.currentStatus, status: columnId },
    }
    setColumns(prev => ({
      ...prev,
      [fromStatus]: {
        ...prev[fromStatus],
        items: prev[fromStatus].items.filter(i => i._id !== followup._id),
        totalRecords: Math.max(0, prev[fromStatus].totalRecords - 1),
      },
      [columnId]: {
        ...prev[columnId],
        items: [movedItem, ...prev[columnId].items],
        totalRecords: prev[columnId].totalRecords + 1,
      },
    }))

    try {
      await updateEventActionStatus(followup._id, {
        status: columnId,
        description: followup.currentStatus?.description || '',
      } as any)
      showSuccess(`Follow-up moved to ${columnId}`)
    } catch (error: any) {
      showError(error?.message || 'Failed to move follow-up')
      loadColumnPage(fromStatus, 1, false)
      loadColumnPage(columnId, 1, false)
    }
  }

  const handleFollowUpClick = (followup: EventAction) => {
    setSelectedFollowUp(followup)
    setShowDetailModal(true)
  }

  const handleFollowUpCreated = () => {
    setShowCreateModal(false)
    reloadAll()
  }

  const handleFollowUpUpdated = (updatedFollowUp?: EventAction) => {
    if (updatedFollowUp && selectedFollowUp) {
      setSelectedFollowUp(updatedFollowUp)
      setColumns(prev => {
        const next = { ...prev }
        FOLLOWUP_STATUSES.forEach(status => {
          next[status] = {
            ...next[status],
            items: next[status].items.map(f => f._id === updatedFollowUp._id ? updatedFollowUp : f),
          }
        })
        return next
      })
      reloadAll(true)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="px-4 pt-3 pb-1">
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as 'mine' | 'assigned')}
          className="cok-auth-input text-sm cursor-pointer"
          style={{ paddingLeft: '12px', width: 'auto', minWidth: '180px' }}
        >
          <option value="mine">My tasks</option>
          <option value="assigned">Assigned to</option>
        </select>
      </div>

      {viewMode === 'assigned' ? (
        <div className="px-4 pb-8 pt-2">
          <AssignedFollowUps />
        </div>
      ) : (
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden px-4 pb-8 pt-2"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex gap-5 min-w-max" style={{ paddingBottom: '8px' }}>
          {COLUMN_DEFS.map((def) => {
            const col = columns[def.id]
            return (
              <div
                key={def.id}
                className="w-[300px] sm:w-[340px] md:w-[380px] flex-shrink-0 flex flex-col"
                style={{
                  backgroundColor: WHITE,
                  border: `3px solid ${draggedOverColumn === def.id ? PRIMARY : BORDER}`,
                  borderRadius: 0,
                  transition: 'border-color 0.2s ease',
                }}
                onDragOver={(e) => handleDragOver(e, def.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, def.id)}
              >
                <div className="px-5 py-4 flex-shrink-0" style={{ backgroundColor: def.headerColor }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold" style={{ color: WHITE, fontFamily: fontHeading }}>
                      {def.title.toLocaleUpperCase()}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold px-2.5 py-0.5"
                        style={{ color: WHITE, backgroundColor: 'rgba(255,255,255,0.2)', fontFamily: fontHeading, borderRadius: 0 }}
                      >
                        {col.totalRecords}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColumnStatus(def.id)
                          setShowCreateModal(true)
                        }}
                        className="px-1.5 cursor-pointer text-lg font-bold leading-none"
                        style={{ color: 'rgba(255,255,255,0.85)', background: 'transparent', border: 0 }}
                        title={`Add follow-up to ${def.title}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="flex-1 p-4 space-y-3 min-h-[500px] max-h-[calc(80vh-100px)] overflow-y-auto custom-scrollbar"
                  onScroll={(e) => handleColumnScroll(e, def.id)}
                >
                  {col.initialLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                    </div>
                  ) : col.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No follow-ups</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColumnStatus(def.id)
                          setShowCreateModal(true)
                        }}
                        className="mt-3 text-xs cursor-pointer font-medium"
                        style={{ color: PRIMARY, fontFamily: fontHeading }}
                      >
                        + Add a follow-up
                      </button>
                    </div>
                  ) : (
                    <>
                      {col.items.map((followup) => (
                        <div
                          key={followup._id}
                          draggable
                          onDragStart={() => handleDragStart(followup)}
                          className="cursor-grab active:cursor-grabbing"
                          style={{
                            transition: 'opacity 0.3s ease, transform 0.3s ease',
                            opacity: draggedFollowUp?._id === followup._id ? 0.4 : 1,
                            transform: draggedFollowUp?._id === followup._id ? 'scale(0.95)' : 'scale(1)',
                          }}
                        >
                          <FollowUpCard
                            followup={followup}
                            onClick={() => handleFollowUpClick(followup)}
                            onUpdate={() => reloadAll()}
                            onDelete={() => reloadAll()}
                            draggedFollowUpId={draggedFollowUp?._id || null}
                          />
                        </div>
                      ))}

                      {col.loadingMore && (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                          <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading more...</span>
                        </div>
                      )}

                      {!col.loadingMore && col.page >= col.totalPages && col.items.length >= PAGE_SIZE && (
                        <p className="text-center text-xs py-3" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                          All follow-ups loaded
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {showCreateModal && (
        <CreateFollowUpModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleFollowUpCreated}
          FollowUpStatus={selectedColumnStatus}
        />
      )}

      {showDetailModal && selectedFollowUp && (
        <FollowUpDetailModal
          followup={selectedFollowUp}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedFollowUp(null)
          }}
          onUpdate={handleFollowUpUpdated}
          onDelete={() => {
            setShowDetailModal(false)
            setSelectedFollowUp(null)
            reloadAll()
          }}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  )
}

export default FollowUpManager
