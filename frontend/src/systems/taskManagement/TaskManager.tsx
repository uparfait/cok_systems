import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '../../core/services/taskService'
import {
  getTasks,
  moveTask,
  getTaskProgress,
  getTaskStatusColor
} from '../../core/services/taskService'
import { useAuth } from '../../core/contexts/AuthContext'
import { useToast } from '../../core/contexts/ToastContext'
import useTaskRealtime from '../../core/hooks/useTaskRealtime'
import TaskCard from './components/TaskCard'
import TaskDetailModal from './components/TaskDetailModal'
import CreateTaskModal from './components/CreateTaskModal'
import './TaskManager.css'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_LIGHT = '#F7F9FB'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const fontHeading = "'Montserrat', sans-serif"

const PAGE_SIZE = 20

type TaskStatus = Task['status']

interface ColumnDef {
  id: string
  title: string
  status: TaskStatus
  headerColor: string
}

interface ColumnState {
  tasks: Task[]
  total: number
  initialLoading: boolean
  loadingMore: boolean
}

const COLUMN_DEFS: ColumnDef[] = [
  { id: 'under-review', title: 'Under Review', status: 'Under-review' as TaskStatus, headerColor: '#6B7280' },
  { id: 'in-progress',  title: 'In Progress',  status: 'In-progress' as TaskStatus,  headerColor: PRIMARY },
  { id: 'completed',    title: 'Completed',    status: 'Completed' as TaskStatus,    headerColor: '#0D9488' },
]

const emptyColumn = (): ColumnState => ({
  tasks: [],
  total: 0,
  initialLoading: true,
  loadingMore: false,
})

const TaskManager: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [SelectedColumnStatus, setSelectedColumnStatus] = useState<TaskStatus>('Under-review' as TaskStatus)

  const [columns, setColumns] = useState<Record<string, ColumnState>>({
    'Under-review': emptyColumn(),
    'In-progress': emptyColumn(),
    'Completed': emptyColumn(),
  })
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)
  const [optimisticTaskId, setOptimisticTaskId] = useState<string | null>(null)

  // Load one page of one status column (first 20, then more as the user
  // scrolls to the bottom of the column)
  const loadColumnPage = useCallback(async (status: TaskStatus, append: boolean) => {
    if (!user?.userId) return

    setColumns(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        initialLoading: !append && prev[status].tasks.length === 0,
        loadingMore: append,
      },
    }))

    try {
      const skip = append ? columnsRef.current[status].tasks.length : 0
      const response: any = await getTasks({
        incharge: user.userId,
        status,
        limit: PAGE_SIZE,
        skip,
      })

      if (response.status) {
        const tasks: Task[] = response.data?.tasks || []
        const total: number = response.data?.pagination?.total ?? tasks.length

        setColumns(prev => {
          const existing = append ? prev[status].tasks : []
          const seen = new Set(existing.map(t => t._id))
          const merged = [...existing, ...tasks.filter(t => !seen.has(t._id))]
          return {
            ...prev,
            [status]: {
              tasks: merged,
              total,
              initialLoading: false,
              loadingMore: false,
            },
          }
        })
      }
    } catch (error: any) {
      showError(error?.message || 'Failed to load tasks')
      setColumns(prev => ({
        ...prev,
        [status]: { ...prev[status], initialLoading: false, loadingMore: false },
      }))
    }
  }, [user?.userId, showError])

  const reloadAll = useCallback(() => {
    COLUMN_DEFS.forEach(def => loadColumnPage(def.status, false))
  }, [loadColumnPage])

  useEffect(() => { reloadAll() }, [reloadAll])

  useTaskRealtime({
    onTaskStatusUpdated: () => { reloadAll() },
    onTaskUpdated: () => { reloadAll() },
  })

  // Infinite scroll: hit the bottom of a column -> load the next page
  const handleColumnScroll = (e: React.UIEvent<HTMLDivElement>, status: TaskStatus) => {
    const el = e.currentTarget
    const col = columnsRef.current[status]
    if (!col || col.loadingMore || col.initialLoading) return
    if (col.tasks.length >= col.total) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      loadColumnPage(status, true)
    }
  }

  const handleDragStart = (task: Task) => setDraggedTask(task)

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(columnId)
  }

  const handleDragLeave = () => setDraggedOverColumn(null)

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(null)

    const task = draggedTask
    setDraggedTask(null)
    if (!task) return

    const destDef = COLUMN_DEFS.find(d => d.id === columnId)
    if (!destDef) return

    const fromStatus = task.status
    const toStatus = destDef.status
    if (fromStatus === toStatus) return

    const toPosition = columnsRef.current[toStatus]?.tasks.length || 0

    // Optimistic move between columns
    const movedTask: Task = { ...task, status: toStatus }
    setColumns(prev => ({
      ...prev,
      [fromStatus]: {
        ...prev[fromStatus],
        tasks: prev[fromStatus].tasks.filter(t => t._id !== task._id),
        total: Math.max(0, prev[fromStatus].total - 1),
      },
      [toStatus]: {
        ...prev[toStatus],
        tasks: [...prev[toStatus].tasks, movedTask],
        total: prev[toStatus].total + 1,
      },
    }))
    setOptimisticTaskId(task._id || null)

    try {
      await moveTask(task._id!, task.list || '', columnId, toPosition)
      showSuccess(`Task moved to ${destDef.title}`)
      setOptimisticTaskId(null)

      if (selectedTask?._id === task._id) {
        setSelectedTask(prev => prev ? { ...prev, status: toStatus } : null)
      }
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move task')
      setOptimisticTaskId(null)
      // Revert by reloading the two affected columns
      loadColumnPage(fromStatus, false)
      loadColumnPage(toStatus, false)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  const handleTaskCreated = () => {
    setShowCreateModal(false)
    reloadAll()
    showSuccess('Task created successfully')
  }

  const handleTaskUpdated = (updatedTask?: Task) => {
    if (updatedTask && selectedTask) {
      setSelectedTask(updatedTask)
      setColumns(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(status => {
          next[status] = {
            ...next[status],
            tasks: next[status].tasks.map(t => t._id === selectedTask._id ? updatedTask : t),
          }
        })
        return next
      })
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Scrollable Columns Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden px-4 pb-8 pt-2"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex gap-5 min-w-max" style={{ paddingBottom: '8px' }}>
          {COLUMN_DEFS.map((def) => {
            const col = columns[def.status] || emptyColumn()
            return (
              <div
                key={def.id}
                className="w-[300px] sm:w-[340px] md:w-[380px] flex-shrink-0 flex flex-col"
                style={{
                  backgroundColor: WHITE,
                  border: `3px solid ${draggedOverColumn === def.id ? PRIMARY : BORDER}`,
                  borderRadius: 0,
                  transition: 'border-color 0.2s ease'
                }}
                onDragOver={(e) => handleDragOver(e, def.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, def.id)}
              >
                {/* Column Header */}
                <div
                  className="px-5 py-4 flex-shrink-0"
                  style={{ backgroundColor: def.headerColor }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold" style={{ color: WHITE, fontFamily: fontHeading }}>
                      {def.title.toLocaleUpperCase()}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold px-2.5 py-0.5" style={{
                        color: WHITE,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        fontFamily: fontHeading,
                        borderRadius: 0
                      }}>
                        {col.total}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColumnStatus(def.status)
                          setShowCreateModal(true)
                        }}
                        className="p-1 cursor-pointer"
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                        title={`Add task to ${def.title}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tasks Container with per-column infinite scroll */}
                <div
                  className="flex-1 p-4 space-y-3 min-h-[500px] max-h-[calc(80vh-100px)] overflow-y-auto custom-scrollbar"
                  onScroll={(e) => handleColumnScroll(e, def.status)}
                >
                  {col.initialLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                    </div>
                  ) : col.tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 flex items-center justify-center mb-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                        <svg className="w-6 h-6" style={{ color: GRAY_DISABLED }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 0 01-2-2V5a2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No tasks</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColumnStatus(def.status)
                          setShowCreateModal(true)
                        }}
                        className="mt-3 text-xs cursor-pointer font-medium"
                        style={{ color: PRIMARY, fontFamily: fontHeading }}
                      >
                        + Add a task
                      </button>
                    </div>
                  ) : (
                    <>
                      {col.tasks.map((task) => {
                        const isOptimistic = optimisticTaskId === task._id
                        return (
                          <div
                            key={task._id}
                            draggable
                            onDragStart={() => handleDragStart(task)}
                            className="cursor-grab active:cursor-grabbing"
                            style={{
                              transition: 'opacity 0.3s ease, transform 0.3s ease',
                              opacity: draggedTask?._id === task._id ? 0.4 : 1,
                              transform: draggedTask?._id === task._id ? 'scale(0.95)' : 'scale(1)',
                              outline: isOptimistic ? `2px solid ${PRIMARY}` : 'none',
                              outlineOffset: isOptimistic ? '2px' : '0'
                            }}
                          >
                            <TaskCard
                              task={task}
                              onClick={() => handleTaskClick(task)}
                              progress={getTaskProgress(task)}
                              statusColor={getTaskStatusColor(task)}
                              onUpdate={() => handleTaskClick(task)}
                              onMove={() => reloadAll()}
                              draggedTaskId={draggedTask?._id || null}
                            />
                          </div>
                        )
                      })}

                      {col.loadingMore && (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                          <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading more...</span>
                        </div>
                      )}

                      {!col.loadingMore && col.tasks.length >= col.total && col.tasks.length >= PAGE_SIZE && (
                        <p className="text-center text-xs py-3" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                          All tasks loaded
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

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleTaskCreated}
          TaskStatus={SelectedColumnStatus}
        />
      )}

      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedTask(null)
            reloadAll()
          }}
          onUpdate={handleTaskUpdated}
          onDelete={() => {
            setShowDetailModal(false)
            setSelectedTask(null)
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

export default TaskManager
