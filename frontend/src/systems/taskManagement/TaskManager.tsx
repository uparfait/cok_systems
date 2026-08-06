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
import { FiLoader } from 'react-icons/fi'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_DARK = '#333333'
const NEUTRAL_LIGHT = '#F7F9FB'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const fontHeading = "'Montserrat', sans-serif"

interface TaskColumn {
  id: string
  title: string
  status: Task['status']
  tasks: Task[]
  headerColor: string
  borderColor: string
}

const TaskManager: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDraggingScroll, setIsDraggingScroll] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [SelectedColumnStatus, setSelectedColumnStatus] = useState<Task['status']>('Under-review')

  const [columns, setColumns] = useState<TaskColumn[]>([
    {
      id: 'under-review',
      title: 'Under Review',
      status: 'Under-review',
      tasks: [],
      headerColor: '#6B7280',
      borderColor: '#E0E0E0'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'In-progress',
      tasks: [],
      headerColor: PRIMARY,
      borderColor: '#E0E0E0'
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'Completed',
      tasks: [],
      headerColor: '#0D9488',
      borderColor: '#E0E0E0'
    }
  ])

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loading, setLoading] = useState({
    tasks: false,
    columns: false
  })

  const [firstLoad, setFirstLoad] = useState(true)

  const loadTasks = useCallback(async (showLoader = true) => {
    if (!user?.userId) return

    try {
      if (showLoader) setLoading(prev => ({ ...prev, tasks: true }))
      const response = await getTasks({
        incharge: user.userId,
        limit: 100
      })

      if (response.status) {
        const tasks = (response as any).data.tasks || []

        const groupedTasks = {
          'Under-review': tasks.filter((task: Task) => task.status === 'Under-review'),
          'In-progress': tasks.filter((task: Task) => task.status === 'In-progress'),
          'Completed': tasks.filter((task: Task) => task.status === 'Completed')
        }

        setColumns(prevColumns =>
          prevColumns.map(column => ({
            ...column,
            tasks: groupedTasks[column.status] || []
          }))
        )
      }
    } catch (error: any) {
      showError(error?.message || 'Failed to load tasks')
    } finally {
      setFirstLoad(false)
      if (showLoader) setLoading(prev => ({ ...prev, tasks: false }))
    }
  }, [user?.userId, showError])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useTaskRealtime({
    onTaskStatusUpdated: (data) => {
      loadTasks(false)
    },
    onTaskUpdated: () => {
      loadTasks(false)
    }
  })

  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(null)

    if (!draggedTask) return

    const sourceColumnIndex = columns.findIndex(col =>
      col.tasks.some(task => task._id === draggedTask._id)
    )
    const destinationColumnIndex = columns.findIndex(col => col.id === columnId)

    if (sourceColumnIndex === -1 || destinationColumnIndex === -1) return

    if (sourceColumnIndex === destinationColumnIndex) {
      setDraggedTask(null)
      return
    }

    const destinationColumn = columns[destinationColumnIndex]
    const newStatus = destinationColumn.status
    const newPosition = destinationColumn.tasks.length

    try {
      await moveTask(draggedTask._id!, draggedTask.list || '', destinationColumn.id, newPosition)
      showSuccess(`Task moved to ${destinationColumn.title}`)

      const sourceColumn = columns[sourceColumnIndex]
      const taskIndex = sourceColumn.tasks.findIndex(task => task._id === draggedTask._id)
      const [movedTask] = sourceColumn.tasks.splice(taskIndex, 1)

      setColumns(prevColumns =>
        prevColumns.map(column => {
          if (column.id === columns[sourceColumnIndex].id) {
            return { ...column, tasks: sourceColumn.tasks }
          }
          if (column.id === columnId) {
            return { ...column, tasks: [...column.tasks, { ...movedTask, status: newStatus }] }
          }
          return column
        })
      )

      if (selectedTask?._id === draggedTask._id) {
        setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move task')
      loadTasks(false)
    } finally {
      setDraggedTask(null)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  const handleTaskCreated = () => {
    setShowCreateModal(false)
    loadTasks()
    showSuccess('Task created successfully')
  }

  const handleTaskUpdated = (updatedTask?: Task) => {
    if (updatedTask && selectedTask) {
      setSelectedTask(updatedTask)

      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.map(task =>
            task._id === selectedTask._id ? updatedTask : task
          )
        }))
      )

      showSuccess('Task updated successfully')
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
    <div className="min-h-screen" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Scrollable Columns Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden px-4 pb-8 pt-2"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex gap-5 min-w-max" style={{ paddingBottom: '8px' }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className="w-[340px] md:w-[380px] flex-shrink-0 flex flex-col"
              style={{
                backgroundColor: WHITE,
                border: `1px solid ${BORDER}`,
                borderRadius: 0,
                opacity: loading.tasks && firstLoad ? 0.75 : 1
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div
                className="px-5 py-4 flex-shrink-0"
                style={{ backgroundColor: column.headerColor }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold" style={{ color: WHITE, fontFamily: fontHeading }}>
                      {column.title?.toLocaleUpperCase()}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold px-2.5 py-0.5" style={{
                      color: WHITE,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      fontFamily: fontHeading,
                      borderRadius: 4e5
                    }}>
                      {column.tasks.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedColumnStatus(column.status)
                        setShowCreateModal(true)
                      }}
                      className="p-1 cursor-pointer"
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                      title={`Add task to ${column.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks Container */}
              <div className="flex-1 p-4 space-y-3 min-h-[500px] max-h-[calc(80vh-100px)] overflow-y-auto custom-scrollbar">
                {loading.tasks && firstLoad ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : column.tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 flex items-center justify-center mb-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                      <svg className="w-6 h-6" style={{ color: GRAY_DISABLED }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No tasks</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedColumnStatus(column.status)
                        setShowCreateModal(true)
                      }}
                      className="mt-3 text-xs cursor-pointer font-medium"
                      style={{ color: PRIMARY, fontFamily: fontHeading }}
                    >
                      + Add a task
                    </button>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="cursor-grab active:cursor-grabbing"
                      style={{
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        opacity: draggedTask?._id === task._id ? 0.4 : 1,
                        transform: draggedTask?._id === task._id ? 'scale(0.95)' : 'scale(1)'
                      }}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => handleTaskClick(task)}
                        progress={getTaskProgress(task)}
                        statusColor={getTaskStatusColor(task)}
                        onUpdate={() => handleTaskClick(task)}
                        onMove={() => loadTasks(false)}
                        draggedTaskId={draggedTask?._id || null}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
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
          }}
          onUpdate={handleTaskUpdated}
          onDelete={() => {
            setShowDetailModal(false)
            setSelectedTask(null)
            loadTasks(false)
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
      `}</style>
    </div>
  )
}

export default TaskManager
