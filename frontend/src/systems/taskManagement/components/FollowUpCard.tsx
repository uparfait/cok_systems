// FollowUpCard - copies the TaskCard design exactly (same card structure and colors)

import React, { useState, useEffect } from 'react'
import { FiClock, FiMoreVertical, FiEdit, FiMove, FiTrash2 } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import { updateEventActionStatus, deleteEventAction, type EventAction } from '../../../core/services/eventActionService'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_DARK = '#333333'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const DANGER = '#E74C3C'
const SUCCESS = '#4CAF50'
const fontHeading = "'Montserrat', sans-serif"

interface FollowUpCardProps {
  followup: EventAction
  onClick: () => void
  onUpdate?: () => void
  onDelete?: () => void
  draggedFollowUpId?: string | null
}

const MOVE_TARGETS: Record<string, string[]> = {
  'Pending': ['In Progress', 'Completed'],
  'In Progress': ['Completed'],
  'Completed': [],
  'Cancelled': ['Pending'],
}

const FollowUpCard: React.FC<FollowUpCardProps> = ({
  followup,
  onClick,
  onUpdate,
  onDelete,
  draggedFollowUpId
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

  const handleMoveStatus = async (newStatus: string) => {
    if (newStatus === followup.currentStatus?.status) return

    setLoading(true)
    try {
      await updateEventActionStatus(followup._id, {
        status: newStatus as any,
        description: followup.currentStatus?.description || ''
      } as any)
      showSuccess(`Follow-up moved to ${newStatus}`)
      onUpdate?.()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move follow-up')
    } finally {
      setLoading(false)
      setShowDropdown(false)
    }
  }

  const handleDeleteFollowUp = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    try {
      await deleteEventAction(followup._id)
      showSuccess('Follow-up deleted successfully')
      onDelete?.()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to delete follow-up')
    } finally {
      setLoading(false)
      setShowDropdown(false)
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

  const status = followup.currentStatus?.status || 'Pending'

  return (
    <div
      className="cursor-pointer"
      style={{
        backgroundColor: "#fdfdfdfd",
        border: `3px solid #f1f1f1f1`,
        borderRadius: 10,
        padding: '16px',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        opacity: draggedFollowUpId === followup._id ? 0.4 : 1,
        transform: draggedFollowUpId === followup._id ? 'scale(0.95)' : 'scale(1)'
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
                    onClick()
                    setShowDropdown(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                  style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                >
                  <FiEdit className="w-4 h-4 mr-2" />
                  Edit Follow-up
                </button>

                <div className="mx-2 my-1" style={{ borderTop: `1px solid ${BORDER}` }} />

                {(MOVE_TARGETS[status] || []).map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveStatus(target)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                    style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                  >
                    <FiMove className="w-4 h-4 mr-2" />
                    {target}
                  </button>
                ))}

                <div className="mx-2 my-1" style={{ borderTop: `1px solid ${BORDER}` }} />

                <button
                  type="button"
                  onClick={handleDeleteFollowUp}
                  disabled={loading}
                  className="flex items-center w-full px-4 py-2 text-sm cursor-pointer"
                  style={{ color: DANGER, fontFamily: fontHeading }}
                >
                  <FiTrash2 className="w-4 h-4 mr-2" />
                  Delete Follow-up
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title - Uppercase */}
      <h3 className="font-semibold mb-2 truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, textTransform: 'uppercase' }} title={followup.title}>
        {followup.title?.trim()}
      </h3>

      {/* Description */}
      {followup.actionDescription && (
        <p className="text-sm mb-3 line-clamp-2" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }} title={followup.actionDescription}>
          {followup.actionDescription.trim()}
        </p>
      )}

      {/* Status Indicator */}
      <div className="flex items-center mb-2">
        <div className="w-2 h-2 mr-2" style={{
          backgroundColor: status === 'Completed' ? SUCCESS : status === 'In Progress' ? PRIMARY : GRAY_DISABLED,
          borderRadius: 460
        }} />
        <span className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          {status}
        </span>
      </div>

      {/* Due Date */}
      {followup.dueDate && (
        <div className="flex items-center text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          <FiClock className="w-3 h-3 mr-1" />
          <span>Due: {formatDate(followup.dueDate)}</span>
        </div>
      )}
    </div>
  )
}

export default FollowUpCard
