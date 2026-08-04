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
import { FiLoader } from 'react-icons/fi'

const PRIMARY = '#056daa'
const BORDER = '#E0E0E0'
const WHITE = '#FFFFFF'
const GRAY_DISABLED = '#9E9E9E'
const fontHeading = "'Montserrat', sans-serif"

const FOLLOWUP_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'] as const
type FollowUpStatus = typeof FOLLOWUP_STATUSES[number]

interface FollowUpColumn {
  id: string
  title: string
  status: FollowUpStatus
  followups: EventAction[]
  headerColor: string
  borderColor: string
}

const FollowUpManager: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDraggingScroll, setIsDraggingScroll] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<FollowUpStatus>('Pending')

  const [columns, setColumns] = useState<FollowUpColumn[]>([
    {
      id: 'pending',
      title: 'Pending',
      status: 'Pending',
      followups: [],
      headerColor: 'from-amber-600 to-amber-600',
      borderColor: 'border-amber-200'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'In Progress',
      followups: [],
      headerColor: 'from-blue-600 to-blue-600',
      borderColor: 'border-blue-200'
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'Completed',
      followups: [],
      headerColor: 'from-emerald-600 to-emerald-600',
      borderColor: 'border-emerald-200'
    },
    {
      id: 'cancelled',
      title: 'Cancelled',
      status: 'Cancelled',
      followups: [],
      headerColor: 'from-red-600 to-red-600',
      borderColor: 'border-red-200'
    }
  ])

  const [selectedFollowUp, setSelectedFollowUp] = useState<EventAction | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)

  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true)
      const response = await getEventActions({
        limit: 100,
        page: 1
      })

      if (response.status) {
        const followups = (response as any).data?.data || []

        const grouped = {
          'Pending': followups.filter((f: EventAction) => f.currentStatus?.status === 'Pending'),
          'In Progress': followups.filter((f: EventAction) => f.currentStatus?.status === 'In Progress'),
          'Completed': followups.filter((f: EventAction) => f.currentStatus?.status === 'Completed'),
          'Cancelled': followups.filter((f: EventAction) => f.currentStatus?.status === 'Cancelled')
        }

        setColumns(prev =>
          prev.map(column => ({
            ...column,
            followups: grouped[column.status] || []
          }))
        )
      }
    } catch (error: any) {
      showError(error?.message || 'Failed to load follow-ups')
    } finally {
      setFirstLoad(false)
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadFollowups()
  }, [loadFollowups])

  const handleDragStart = (followup: EventAction) => {
    ;(window as any).__draggedFollowUp = followup
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    ;(window as any).__draggedOverColumn = columnId
  }

  const handleDragLeave = () => {
    ;(window as any).__draggedOverColumn = null
  }

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    const draggedFollowUp = (window as any).__draggedFollowUp as EventAction | undefined
    ;(window as any).__draggedFollowUp = null
    ;(window as any).__draggedOverColumn = null

    if (!draggedFollowUp) return

    const currentStatus = draggedFollowUp.currentStatus?.status
    if (currentStatus === columnId) return

    setLoading(true)
    try {
      await updateEventActionStatus(draggedFollowUp._id, {
        status: columnId as FollowUpStatus,
        description: draggedFollowUp.currentStatus?.description || ''
      })
      showSuccess(`Follow-up moved to ${columnId}`)
      loadFollowups()
    } catch (error: any) {
      showError(error?.message || 'Failed to move follow-up')
    } finally {
      setLoading(false)
    }
  }

  const handleFollowUpClick = (followup: EventAction) => {
    setSelectedFollowUp(followup)
    setShowDetailModal(true)
  }

  const handleFollowUpCreated = () => {
    setShowCreateModal(false)
    loadFollowups()
    showSuccess('Follow-up created successfully')
  }

  const handleFollowUpUpdated = (updatedFollowUp?: EventAction) => {
    if (updatedFollowUp && selectedFollowUp) {
      setSelectedFollowUp(updatedFollowUp)

      setColumns(prev =>
        prev.map(column => ({
          ...column,
          followups: column.followups.map(f =>
            f._id === selectedFollowUp._id ? updatedFollowUp : f
          )
        }))
      )

      showSuccess('Follow-up updated successfully')
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    setIsDraggingScroll(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
    scrollContainerRef.current.style.cursor = 'grabbing'
    scrollContainerRef.current.style.userSelect = 'none'
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 1.5
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    if (!scrollContainerRef.current) return
    setIsDraggingScroll(false)
    scrollContainerRef.current.style.cursor = 'grab'
    scrollContainerRef.current.style.userSelect = 'auto'
  }

  const handleMouseLeave = () => {
    if (!scrollContainerRef.current) return
    setIsDraggingScroll(false)
    scrollContainerRef.current.style.cursor = 'grab'
    scrollContainerRef.current.style.userSelect = 'auto'
  }

  return (
    <div className="task-manager-container min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div
        ref={scrollContainerRef}
        className="columns-scroll-container overflow-x-auto overflow-y-hidden cursor-grab px-4 pb-8 pt-2"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex gap-5 min-w-max" style={{ paddingBottom: '8px' }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className={`column-card w-[340px] md:w-[380px] flex-shrink-0 rounded-sm bg-gradient-to-br border shadow-xl hover:shadow-2xl transition-all duration-300 
                ${(window as any).__draggedOverColumn === column.id ? 'ring-4 ring-blue-400/50 ring-offset-2 scale-[1.02]' : ''} 
                ${loading ? 'opacity-75' : ''} 
                bg-white/40`}
              style={{
                transform: 'perspective(1200px) rotateX(2deg)',
                transformStyle: 'preserve-3d',
                transition: 'all 0.2s ease',
                borderColor: '#E0E0E0'
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div
                className={`relative px-5 py-4 rounded-t-sm bg-gradient-to-r ${column.headerColor}`}
                style={{
                  transform: 'translateZ(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: fontHeading }}>
                      {column.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/90 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm" style={{ fontFamily: fontHeading }}>
                      {column.followups.length}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedColumnStatus(column.status)
                        setShowCreateModal(true)
                      }}
                      className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                      title={`Add follow-up to ${column.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3 min-h-[500px] max-h-[calc(80vh-100px)] overflow-y-auto custom-scrollbar">
                {loading && firstLoad ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="relative">
                      <div className="rounded-full h-8 w-8">
                        <FiLoader className="animate-spin text-blue-500" size={32} />
                      </div>
                    </div>
                  </div>
                ) : column.followups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/50 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500" style={{ fontFamily: fontHeading }}>No follow-ups</p>
                    <button
                      onClick={() => {
                        setSelectedColumnStatus(column.status)
                        setShowCreateModal(true)
                      }}
                      className="mt-3 text-xs hover:cursor-pointer text-blue-500 hover:text-blue-600 font-medium"
                      style={{ fontFamily: fontHeading }}
                    >
                      + Add a follow-up
                    </button>
                  </div>
                ) : (
                  column.followups.map((followup) => (
                    <div
                      key={followup._id}
                      draggable
                      onDragStart={() => handleDragStart(followup)}
                      className={`cursor-grab active:cursor-grabbing transition-all duration-150 ${(window as any).__draggedFollowUp?._id === followup._id ? 'opacity-40 rotate-1 scale-95' : 'hover:scale-[1.02]'}`}
                      style={{
                        transform: 'translateZ(4px)',
                        transition: 'transform 0.15s ease, opacity 0.15s ease'
                      }}
                    >
                      <FollowUpCard
                        followup={followup}
                        onClick={() => handleFollowUpClick(followup)}
                        onUpdate={() => loadFollowups()}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 pb-3 pt-1">
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

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
            loadFollowups()
          }}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.3);
        }
        
        .columns-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        
        .columns-scroll-container::-webkit-scrollbar {
          height: 6px;
        }
        
        .columns-scroll-container::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 10px;
        }
        
        .columns-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.15);
          border-radius: 10px;
        }
        
        .columns-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.25);
        }
        
        .column-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .column-card:hover {
          transform: perspective(1200px) rotateX(1deg) translateY(-4px);
          box-shadow: 0 25px 40px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  )
}

export default FollowUpManager
