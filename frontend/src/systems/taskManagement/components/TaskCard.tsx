// TaskCard - Individual task card component with priority borders and CoK design

import React, { useState, useEffect } from 'react'
import { FiClock, FiMessageSquare, FiPaperclip, FiMoreVertical, FiEdit, FiMove, FiTrash2 } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import { updateTaskStatus, deleteTask } from '../../../core/services/taskService'
import type { Task, TaskStatus } from '../../../core/services/taskService'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_DARK = '#333333'
const NEUTRAL_LIGHT = '#F7F9FB'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const DANGER = '#E74C3C'
const SUCCESS = '#4CAF50'
const WARNING = '#F39C12'
const fontHeading = "'Montserrat', sans-serif"

interface TaskCardProps {
  task: Task
  onClick: () => void
  progress: number
  statusColor: string
  onUpdate?: () => void
  onDelete?: () => void
  onMove?: (status: TaskStatus) => void
  draggedTaskId?: string | null
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  progress,
  statusColor,
  onUpdate,
  onDelete,
  onMove,
  draggedTaskId
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

  const handleDeleteTask = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const getPriorityBorderColor = () => {
    switch (task.priority) {
      case 'Low': return SUCCESS
      case 'Medium': return WARNING
      case 'High': return '#FF7043'
      case 'Urgent': return DANGER
      default: return BORDER
    }
  }

  const getPriorityBadgeStyle = (): React.CSSProperties => {
    switch (task.priority) {
      case 'Low':
        return { backgroundColor: '#E9F5EA', color: SUCCESS }
      case 'Medium':
        return { backgroundColor: '#FFF8E1', color: WARNING }
      case 'High':
        return { backgroundColor: '#FFF3E0', color: '#FF7043' }
      case 'Urgent':
        return { backgroundColor: '#FFEBEE', color: DANGER }
      default:
        return { backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false)
    }
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  const borderColor = getPriorityBorderColor()

  return (
    <div
      className="cursor-pointer"
      style={{
        backgroundColor: "#fdfdfdfd",
        border: `3px solid #f1f1f1f1`,
        borderRadius: 10,
        padding: '16px',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        opacity: draggedTaskId === task._id ? 0.4 : 1,
        transform: draggedTaskId === task._id ? 'scale(0.95)' : 'scale(1)'
      }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        setShowDropdown(!showDropdown)
      }}
    >
      {/* Top Dropdown Menu */}
      <div className="flex justify-end mb-2">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
            className="p-1 cursor-pointer"
            style={{ color: GRAY_DISABLED }}
            disabled={loading}
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiMoreVertical className="w-3 h-3" />
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-48 z-10" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
              <div className="py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdate?.()
                    setShowDropdown(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                  style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                >
                  <FiEdit className="w-4 h-4 mr-2" />
                  Edit Task
                </button>

                <div className="mx-2 my-1" style={{ borderTop: `1px solid ${BORDER}` }} />

                {task.status === 'Under-review' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveTask('In-progress')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                      style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                    >
                      <FiMove className="w-4 h-4 mr-2" />
                      In Progress
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveTask('Completed')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                      style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                    >
                      <FiMove className="w-4 h-4 mr-2" />
                      Completed
                    </button>
                  </>
                )}

                {task.status === 'In-progress' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveTask('Completed')
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                    style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                  >
                    <FiMove className="w-4 h-4 mr-2" />
                    Completed
                  </button>
                )}

                <div className="mx-2 my-1" style={{ borderTop: `1px solid ${BORDER}` }} />

                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={loading}
                  className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                  style={{ color: DANGER, fontFamily: fontHeading }}
                >
                  <FiTrash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title - Uppercase */}
      <h3 className="font-semibold mb-2 truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, textTransform: 'uppercase' }} title={task.title}>
        {task.title.trim()}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm mb-3 line-clamp-2" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }} title={task.description}>
          {task.description.trim()}
        </p>
      )}

      {/* Priority Badge */}
      {task.priority && (
        <div className="mb-3 ">
          <span
            className="text-xs px-2 py-0.5 inline-block"
            style={{
              ...getPriorityBadgeStyle(),
              fontFamily: fontHeading,
              borderRadius: 30,
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            {task.priority}
          </span>
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center mb-2">
        <div className="w-2 h-2 mr-2" style={{
          backgroundColor: task.status === 'Completed' ? SUCCESS : task.status === 'In-progress' ? PRIMARY : GRAY_DISABLED,
          borderRadius: 460
        }} />
        <span className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          {task.status.replace('-', ' ')}
        </span>
      </div>

      {/* Progress Bar - Show for all tasks with checklists */}
      {task.checklists && task.checklists.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Progress</span>
            <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              {(() => {
                let total = 0
                let completed = 0
                task.checklists.forEach(c => {
                  if (c.items) {
                    total += c.items.length
                    completed += c.items.filter(i => i.completed).length
                  }
                })
                return `${completed}/${total} (${progress}%)`
              })()}
            </span>
          </div>
          <div className="w-full h-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
            <div
              className="h-2"
              style={{
                width: `${Math.max(progress, 5)}%`,
                backgroundColor: statusColor,
                borderRadius: 0,
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Due Date */}
      {task.dueDate && (
        <div className="flex items-center text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          <FiClock className="w-3 h-3 mr-1" />
          <span>Due: {formatDate(task.dueDate)}</span>
        </div>
      )}
    </div>
  )
}

export default TaskCard
