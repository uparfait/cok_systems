// TaskManager.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { useAuth } from '../../core/contexts/AuthContext'
import { useToast } from '../../core/contexts/ToastContext'
import {
  getTasks,
  updateTaskStatus,
  getTaskProgress,
  getTaskStatusColor
} from '../../core/services/taskService'
import type { Task } from '../../core/services/taskService'
import useTaskRealtime from '../../core/hooks/useTaskRealtime'
import TaskCard from './components/TaskCard'
import TaskDetailModal from './components/TaskDetailModal'
import CreateTaskModal from './components/CreateTaskModal'
import './TaskManager.css'

interface TaskColumn {
  id: string
  title: string
  status: Task['status']
  tasks: Task[]
  gradient: string
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
  const [SelectedColumnStatus, setSelectedColumnStatus] = useState('Under-review')

  const [columns, setColumns] = useState<TaskColumn[]>([
    {
      id: 'under-review',
      title: 'Under Review',
      status: 'Under-review',
      tasks: [],
      gradient: 'from-stone-50 to-stone-100/80',
      headerColor: 'from-stone-600 to-stone-700',
      borderColor: 'border-stone-200'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'In-progress',
      tasks: [],
      gradient: 'from-blue-50 to-indigo-50/80',
      headerColor: 'from-blue-600 to-indigo-600',
      borderColor: 'border-blue-200'
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'Completed',
      tasks: [],
      gradient: 'from-emerald-50 to-teal-50/80',
      headerColor: 'from-emerald-600 to-teal-600',
      borderColor: 'border-emerald-200'
    }
  ])

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loading, setLoading] = useState({
    tasks: false,
    columns: false
  })

  // Load tasks
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

        // Group tasks by status
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
      if (showLoader) setLoading(prev => ({ ...prev, tasks: false }))
    }
  }, [user?.userId, showError])

  // Load tasks on mount and when user changes
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Real-time updates
  useTaskRealtime({
    onTaskStatusUpdated: (data) => {
      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task._id !== data.taskId)
        }))
      )
      loadTasks(false)
    },
    onTaskUpdated: () => {
      loadTasks(false)
    }
  })

  // Drag and drop state
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

    const statusOrder = ['Under-review', 'In-progress', 'Completed']
    const sourceStatusIndex = statusOrder.indexOf(columns[sourceColumnIndex].status)
    const destinationStatusIndex = statusOrder.indexOf(columns[destinationColumnIndex].status)

    if (destinationStatusIndex <= sourceStatusIndex) {
      showError('Tasks can only be moved forward, not backward')
      setDraggedTask(null)
      return
    }

    if (sourceColumnIndex === destinationColumnIndex) {
      setDraggedTask(null)
      return
    }

    const destinationColumn = columns[destinationColumnIndex]
    const newStatus = destinationColumn.status

    try {
      await updateTaskStatus(draggedTask._id!, newStatus)
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
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update task status')
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

  const handleTaskUpdated = () => {
    setShowDetailModal(false)
    setSelectedTask(null)
    loadTasks()
  }

  // Horizontal scroll with drag
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

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="task-manager-container min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
    

      {/* Scrollable Columns Container - with drag-to-scroll */}
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
              className={`column-card w-[340px] md:w-[380px] flex-shrink-0 rounded-2xl bg-gradient-to-br ${column.gradient} 
                border ${column.borderColor} shadow-xl hover:shadow-2xl transition-all duration-300 
                ${draggedOverColumn === column.id ? 'ring-4 ring-blue-400/50 ring-offset-2 scale-[1.02]' : ''} 
                ${loading.tasks ? 'opacity-75' : ''} 
                backdrop-blur-sm bg-white/40`}
              style={{
                transform: 'perspective(1200px) rotateX(2deg)',
                transformStyle: 'preserve-3d',
                transition: 'all 0.2s ease'
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header with distinct gradient */}
              <div
                className={`relative px-5 py-4 rounded-t-2xl bg-gradient-to-r ${column.headerColor}`}
                style={{
                  transform: 'translateZ(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {column.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/90 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                      {column.tasks.length}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedColumnStatus(column.status)
                        setShowCreateModal(true)
                      }}
                      className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                      title={`Add task to ${column.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* 3D edge effect */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>

              {/* Tasks Container */}
              <div className="p-4 space-y-3 min-h-[500px] max-h-[calc(80vh-100px)] overflow-y-auto custom-scrollbar">
                {loading.tasks ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                      <div className="absolute inset-0 rounded-full h-8 w-8 border-t-2 border-transparent"></div>
                    </div>
                  </div>
                ) : column.tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/50 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">No tasks</p>
                    <button
                      onClick={() => {
                        setSelectedColumnStatus(column.status);
                        setShowCreateModal(true)
                      }
                      }
                      className="mt-3 text-xs text-blue-500 hover:text-blue-600 font-medium"
                    >
                      + Add a task
                    </button>
                  </div>
                ) : (
                  column.tasks.map((task, idx) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className={`cursor-grab active:cursor-grabbing transition-all duration-150 ${draggedTask?._id === task._id ? 'opacity-40 rotate-1 scale-95' : 'hover:scale-[1.02]'
                        }`}
                      style={{
                        transform: 'translateZ(4px)',
                        transition: 'transform 0.15s ease, opacity 0.15s ease'
                      }}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => handleTaskClick(task)}
                        progress={getTaskProgress(task)}
                        statusColor={getTaskStatusColor(task)}
                        onUpdate={() => handleTaskClick(task)}
                        onDelete={() => {
                          loadTasks(false)
                        }}
                        onMove={() => {
                          loadTasks(false)
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Add footer note for 3D effect */}
              <div className="px-4 pb-3 pt-1">
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
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
          TaskStatus = {SelectedColumnStatus}
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
        />
      )}

      {/* Custom scrollbar styles */}
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

export default TaskManager