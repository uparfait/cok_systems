// TaskCard - Individual task card component with progress bar and status indicators

import React, { useState } from 'react'
import { FiClock, FiMessageSquare, FiPaperclip, FiMoreVertical, FiEdit, FiTrash2, FiMove } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import { updateTaskStatus, deleteTask } from '../../../core/services/taskService'
import type { Task, TaskStatus } from '../../../core/services/taskService'

interface TaskCardProps {
  task: Task
  onClick: () => void
  progress: number
  statusColor: string
  onUpdate?: () => void
  onDelete?: () => void
  onMove?: (status: TaskStatus) => void
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  progress,
  statusColor,
  onUpdate,
  onDelete,
  onMove
}) => {
  const { showSuccess, showError } = useToast()
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }



  const handleMoveTask = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return

    setLoading(true)
    try {
      await updateTaskStatus(task._id!, newStatus)
      showSuccess(`Task moved to ${newStatus.replace('-', ' ')}`)
      onMove?.(newStatus)
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move task')
    } finally {
      setLoading(false)
      setShowDropdown(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    setLoading(true)
    try {
      await deleteTask(task._id!)
      showSuccess('Task deleted successfully')
      onDelete?.()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to delete task')
    } finally {
      setLoading(false)
      setShowDropdown(false)
    }
  }

  const getProgressBarColor = () => {
    switch (statusColor) {
      case 'red': return 'progress-bar-red'
      case 'orange': return 'progress-bar-orange'
      case 'yellow': return 'progress-bar-yellow'
      case 'green': return 'progress-bar-green'
      default: return 'progress-bar-green'
    }
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false)
    }
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  return (
    <div
      className="task-card bg-white rounded-lg p-4 shadow-sm border border-gray-200  hover:shadow-md transition-all duration-200 max-h-52 overflow-hidden"
      onClick={onClick}
    >
      {/* Top Dropdown Menu */}
      <div className="flex justify-end mb-2">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
            ) : (
              <FiMoreVertical className="w-3 h-3" />
            )}
          </button>

          {showDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdate?.()
                      setShowDropdown(false)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FiEdit className="w-4 h-4 mr-2" />
                    Edit Task
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  {task.status === 'Under-review' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveTask('In-progress')
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiMove className="w-4 h-4 mr-2" />
                        Move to In Progress
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveTask('Completed')
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiMove className="w-4 h-4 mr-2" />
                        Move to Completed
                      </button>
                    </>
                  )}

                  {task.status === 'In-progress' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveTask('Completed')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FiMove className="w-4 h-4 mr-2" />
                      Move to Completed
                    </button>
                  )}

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTask()
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <FiTrash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-2 truncate" title={task.title}>{task.title.trim()}</h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2" title={task.description}>{task.description.trim()}</p>
      )}

      {/* Status Indicator */}
      <div className="flex items-center mb-2">
        <div className={`status-indicator status-${task.status.toLowerCase().replace('-', '-')}`}></div>
        <span className="text-xs text-gray-500 capitalize ml-2">
          {task.status.replace('-', ' ')}
        </span>
      </div>

      {/* Progress Bar - Show for all tasks with checklists */}
      {task.checklists && task.checklists.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Progress</span>
            <span className="text-xs text-gray-600">
              {(() => {
                let total = 0
                let completed = 0
                task.checklists.forEach(c => {
                  if (c.items) {
                    total += c.items.length
                    completed += c.items.filter(i => i.completed).length
                  }
                })
                return `${completed}/${total}`
              })()} ({progress}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.max(progress, 5)}%` }} // Minimum 5% width for visibility
            ></div>
          </div>
        </div>
      )}

      {/* Due Date */}
      {task.dueDate && (
        <div className="flex items-center text-xs text-gray-500 mb-2">
          <FiClock className="w-3 h-3 mr-1" />
          <span>Due: {formatDate(task.dueDate)}</span>
        </div>
      )}

     
    </div>
  )
}

export default TaskCard