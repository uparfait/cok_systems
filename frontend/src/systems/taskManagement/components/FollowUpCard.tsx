import React, { useState } from 'react'
import { FiClock, FiMessageSquare, FiPaperclip, FiMoreVertical, FiEdit, FiMove, FiUser, FiCalendar } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import { updateEventActionStatus, type EventAction } from '../../../core/services/eventActionService'

interface FollowUpCardProps {
  followup: EventAction
  onClick: () => void
  onUpdate?: () => void
}

const FollowUpCard: React.FC<FollowUpCardProps> = ({
  followup,
  onClick,
  onUpdate
}) => {
  const { showSuccess, showError } = useToast()
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleMoveStatus = async (newStatus: string) => {
    if (newStatus === followup.currentStatus?.status) return

    setLoading(true)
    try {
      await updateEventActionStatus(followup._id, {
        status: newStatus as any,
        description: followup.currentStatus?.description || ''
      })
      showSuccess(`Follow-up moved to ${newStatus}`)
      onUpdate?.()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move follow-up')
    } finally {
      setLoading(false)
      setShowDropdown(false)
    }
  }

  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false)
    }
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#F39C12'
      case 'In Progress': return '#2563EB'
      case 'Completed': return '#4CAF50'
      case 'Cancelled': return '#E53935'
      default: return '#9E9E9E'
    }
  }

  return (
    <>
      <div
        className="task-card bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowDropdown(!showDropdown)
        }}
      >
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
                    Edit Follow-up
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  {followup.currentStatus?.status === 'Pending' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveStatus('In Progress')
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiMove className="w-4 h-4 mr-2" />
                        Move to In Progress
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveStatus('Completed')
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiMove className="w-4 h-4 mr-2" />
                        Move to Completed
                      </button>
                    </>
                  )}

                  {followup.currentStatus?.status === 'In Progress' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveStatus('Completed')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FiMove className="w-4 h-4 mr-2" />
                      Move to Completed
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }} title={followup.title}>
          {followup.title}
        </h3>

        {followup.actionDescription && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2" style={{ fontFamily: "'Montserrat', sans-serif" }} title={followup.actionDescription}>
            {followup.actionDescription}
          </p>
        )}

        <div className="flex items-center mb-2">
          <div
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: getStatusColor(followup.currentStatus?.status || 'Pending') }}
          ></div>
          <span className="text-xs text-gray-500 capitalize" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {followup.currentStatus?.status || 'Pending'}
          </span>
        </div>

        {followup.assignedPerson?.name && (
          <div className="flex items-center text-xs text-gray-500 mb-2">
            <FiUser className="w-3 h-3 mr-1" />
            <span style={{ fontFamily: "'Montserrat', sans-serif" }}>{followup.assignedPerson.name}</span>
          </div>
        )}

        {followup.dueDate && (
          <div className="flex items-center text-xs text-gray-500">
            <FiCalendar className="w-3 h-3 mr-1" />
            <span style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Due: {new Date(followup.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </>
  )
}

export default FollowUpCard
