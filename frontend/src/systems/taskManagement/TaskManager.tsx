// TaskManager - Main task management component with drag-and-drop functionality
// Provides a Trello-like interface for managing tasks across three columns

import React, { useState, useEffect, useCallback } from 'react'
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi'
import { useAuth } from '../../core/contexts/AuthContext'
import { useToast } from '../../core/contexts/ToastContext'
import {
  getTasks,
  updateTaskStatus,
  getTaskProgress,
  getTaskStatusColor
} from '../../core/services/taskService'
import type { Task, TaskStatus } from '../../core/services/taskService'
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
  color: string
}

const TaskManager: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [columns, setColumns] = useState<TaskColumn[]>([
    {
      id: 'under-review',
      title: 'Under Review',
      status: 'Under-review',
      tasks: [],
      color: 'bg-gradient-to-br from-stone-100 to-stone-200'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'In-progress',
      tasks: [],
      color: 'bg-gradient-to-br from-blue-100 to-blue-200'
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'Completed',
      tasks: [],
      color: 'bg-gradient-to-br from-green-100 to-green-200'
    }
  ])

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
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
        ...(searchTerm && { title: searchTerm }),
        limit: 100
      })

      if (response.status) {
        const tasks = response.data.tasks || []

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
  }, [user?.userId, searchTerm, showError])

  // Load tasks on mount and when user changes
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Real-time updates
  useTaskRealtime({
    onTaskStatusUpdated: (data) => {
      // Update local state when task status changes via socket
      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task._id !== data.taskId)
        }))
      )

      // Add task to new column
      loadTasks()
    },
    onTaskUpdated: () => {
      loadTasks()
    }
  })

  // Drag and drop state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  // Handle drag start
  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(columnId)
  }

  // Handle drag leave
  const handleDragLeave = () => {
    setDraggedOverColumn(null)
  }

  // Handle drop
  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDraggedOverColumn(null)

    if (!draggedTask) return

    // Find source and destination columns
    const sourceColumnIndex = columns.findIndex(col =>
      col.tasks.some(task => task._id === draggedTask._id)
    )
    const destinationColumnIndex = columns.findIndex(col => col.id === columnId)

    if (sourceColumnIndex === -1 || destinationColumnIndex === -1) return

    // Prevent moving backward (only forward allowed)
    const statusOrder = ['Under-review', 'In-progress', 'Completed']
    const sourceStatusIndex = statusOrder.indexOf(columns[sourceColumnIndex].status)
    const destinationStatusIndex = statusOrder.indexOf(columns[destinationColumnIndex].status)

    if (destinationStatusIndex <= sourceStatusIndex) {
      showError('Tasks can only be moved forward, not backward')
      setDraggedTask(null)
      return
    }

    // Prevent dropping on same column
    if (sourceColumnIndex === destinationColumnIndex) {
      setDraggedTask(null)
      return
    }

    const destinationColumn = columns[destinationColumnIndex]
    const newStatus = destinationColumn.status

    try {
      await updateTaskStatus(draggedTask._id!, newStatus)
      showSuccess(`Task moved to ${destinationColumn.title}`)

      // Update local state
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
    } catch (error: any) {
      showError(error?.message || 'Failed to update task status')
      // Reload tasks to revert optimistic update
      loadTasks(false)
    } finally {
      setDraggedTask(null)
    }
  }

  // Filter tasks based on search
  const getFilteredTasks = (tasks: Task[]) => {
    if (!searchTerm) return tasks

    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
  }

  // Handle task click
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  // Handle task creation
  const handleTaskCreated = () => {
    setShowCreateModal(false)
    loadTasks()
    showSuccess('Task created successfully')
  }

  // Handle task update
  const handleTaskUpdated = () => {
    setShowDetailModal(false)
    setSelectedTask(null)
    loadTasks()
  }

  return (
    <div className="task-manager-container min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Create Task
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading.tasks}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => loadTasks(false)}
              disabled={loading.tasks}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading.tasks ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Task Columns */}
      <div className="task-columns-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map((column) => {
          const filteredTasks = getFilteredTasks(column.tasks)

          return (
            <div
              key={column.id}
              className={`${column.color} rounded-xl p-6 shadow-sm border border-gray-200 min-w-[320px] ${
                draggedOverColumn === column.id ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
              } ${loading.tasks ? 'opacity-75' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{column.title}</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full">
                    {filteredTasks.length}
                  </span>
                  {/* Add task dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-white/50 transition-colors"
                      title={`Add task to ${column.title}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {loading.tasks ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className={`cursor-move ${draggedTask?._id === task._id ? 'opacity-50' : ''}`}
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
                        onMove={(newStatus) => {
                          loadTasks(false)
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleTaskCreated}
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
    </div>
  )
}

export default TaskManager