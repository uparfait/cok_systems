import React, { useState, useRef } from 'react'
import { FiX, FiPaperclip, FiDownload, FiEye, FiUser, FiCalendar, FiClock, FiEdit, FiTrash2 } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  updateEventActionStatus,
  updateEventAction,
  deleteEventAction,
  type EventAction
} from '../../../core/services/eventActionService'

const PRIMARY = '#056daa'
const PRIMARY_HOVER = '#045d94'
const TERTIARY = '#CDB896'
const WHITE = '#FFFFFF'
const BORDER = '#E0E0E0'
const fontHeading = "'Montserrat', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: TERTIARY,
}

interface FollowUpDetailModalProps {
  followup: EventAction
  onClose: () => void
  onUpdate: (updatedFollowUp?: EventAction) => void
  onDelete?: () => void
}

const FollowUpDetailModal: React.FC<FollowUpDetailModalProps> = ({ followup: initialFollowUp, onClose, onUpdate, onDelete }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [followup, setFollowUp] = useState<EventAction>(initialFollowUp)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(initialFollowUp.title)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState(initialFollowUp.actionDescription || '')
  const [loading, setLoading] = useState(false)
  const [viewingAttachment, setViewingAttachment] = useState<any>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#F39C12'
      case 'In Progress': return '#2563EB'
      case 'Completed': return '#4CAF50'
      case 'Cancelled': return '#E53935'
      default: return '#9E9E9E'
    }
  }

  const handleTitleSave = async () => {
    if (!editTitle.trim()) return
    setLoading(true)
    try {
      const res: any = await updateEventAction(followup._id, {
        title: editTitle.trim()
      })
      setFollowUp(res.data)
      setEditingTitle(false)
      onUpdate(res.data)
      showSuccess('Title updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update title')
    } finally {
      setLoading(false)
    }
  }

  const handleDescriptionSave = async () => {
    setLoading(true)
    try {
      const res: any = await updateEventAction(followup._id, {
        actionDescription: editDescription.trim()
      })
      setFollowUp(res.data)
      setEditingDescription(false)
      onUpdate(res.data)
      showSuccess('Description updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update description')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      await updateEventActionStatus(followup._id, {
        status: newStatus as any,
        description: followup.currentStatus?.description || ''
      })
      showSuccess(`Follow-up moved to ${newStatus}`)
      setFollowUp(prev => prev ? { ...prev, currentStatus: { ...prev.currentStatus, status: newStatus as any } } : null)
      onUpdate(followup)
    } catch (error: any) {
      showError(error?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete follow-up "${followup.title}"?`)) return
    setLoading(true)
    try {
      await deleteEventAction(followup._id)
      showSuccess('Follow-up deleted')
      if (onDelete) onDelete()
      onClose()
    } catch (error: any) {
      showError(error?.message || 'Failed to delete follow-up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="border border-[#E0E0E0] w-full max-w-3xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
        {/* Header */}
        <div className="px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: fontHeading }}>
                {followup.title}
              </h2>
              <p className="text-white/80 text-xs mt-0.5">Follow-up</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1.5 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Delete follow-up"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor(followup.currentStatus?.status || 'Pending') }}
            ></div>
            <span className="text-xs text-gray-500 capitalize" style={{ fontFamily: fontHeading }}>
              {followup.currentStatus?.status || 'Pending'}
            </span>
          </div>

          {/* Description */}
          <div>
            <h4 className="uppercase mb-2" style={labelStyle}>Description</h4>
            {editingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border text-sm"
                  style={{ borderColor: BORDER, borderRadius: 0, fontFamily: fontHeading }}
                  rows={3}
                  disabled={loading}
                />
                <div className="flex gap-2">
                  <button onClick={handleDescriptionSave} disabled={loading} className="px-3 py-1.5 text-white text-xs uppercase" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px' }}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingDescription(false)} disabled={loading} className="px-3 py-1.5 border text-xs uppercase" style={{ borderColor: BORDER, borderRadius: 0, fontFamily: fontHeading, color: '#555555' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[#555555]" style={{ fontFamily: fontHeading }}>
                  {followup.actionDescription || 'No description provided.'}
                </p>
                <button onClick={() => setEditingDescription(true)} className="mt-2 text-xs flex items-center gap-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                  <FiEdit className="w-3 h-3" /> Edit
                </button>
              </div>
            )}
          </div>

          {/* Assigned To */}
          <div>
            <h4 className="uppercase mb-2" style={labelStyle}>Assigned To</h4>
            <div className="flex items-center gap-2 text-sm">
              <FiUser className="text-[#9E9E9E] w-3.5 h-3.5" />
              <span style={{ fontFamily: fontHeading, color: '#333333' }}>{followup.assignedPerson?.name}</span>
            </div>
            {followup.assignedPerson?.role && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="text-[#9E9E9E] text-xs" style={{ fontFamily: fontHeading }}>{followup.assignedPerson.role}</span>
              </div>
            )}
            {followup.assignedPerson?.institution && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="text-[#9E9E9E] text-xs" style={{ fontFamily: fontHeading }}>{followup.assignedPerson.institution}</span>
              </div>
            )}
          </div>

          {/* Due Date */}
          <div>
            <h4 className="uppercase mb-2" style={labelStyle}>Due Date</h4>
            <div className="flex items-center gap-2 text-sm">
              <FiCalendar className="text-[#9E9E9E] w-3.5 h-3.5" />
              <span style={{ fontFamily: fontHeading, color: '#333333' }}>
                {followup.dueDate ? new Date(followup.dueDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'No due date set'}
              </span>
            </div>
          </div>

          {/* Change Status */}
          <div>
            <h4 className="uppercase mb-3" style={labelStyle}>Change Status</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['Pending', 'In Progress', 'Completed', 'Cancelled'] as const).map((status) => {
                const isActive = followup.currentStatus?.status === status
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={loading || isActive}
                    className="p-3 border-2 text-center transition-all disabled:opacity-50 cursor-pointer"
                    style={{
                      borderColor: isActive ? getStatusColor(status) : BORDER,
                      backgroundColor: isActive ? getStatusColor(status) + '10' : WHITE,
                      borderRadius: 0,
                      fontFamily: fontHeading
                    }}
                  >
                    <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: getStatusColor(status) }} />
                    <span className="text-xs font-bold uppercase block" style={{ color: isActive ? getStatusColor(status) : '#333333' }}>
                      {status}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold mt-1 block" style={{ color: getStatusColor(status) }}>ACTIVE</span>
                    )}
                  </button>
                )
              })}
            </div>
            {loading && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs" style={{ fontFamily: fontHeading }}>Updating...</span>
              </div>
            )}
          </div>

          {/* Status History */}
          {followup.statusHistory && followup.statusHistory.length > 0 && (
            <div>
              <h4 className="uppercase mb-3" style={labelStyle}>Status History</h4>
              <div className="space-y-3">
                {followup.statusHistory.map((entry, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: getStatusColor(entry.status) }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 capitalize" style={{ fontFamily: fontHeading }}>
                          {entry.status}
                        </span>
                        <span className="text-xs text-gray-400" style={{ fontFamily: fontHeading }}>
                          {new Date(entry.changedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: fontHeading }}>
                        {entry.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {viewingAttachment && (
          <AttachmentViewer
            attachment={viewingAttachment}
            onClose={() => setViewingAttachment(null)}
          />
        )}
      </div>
    </div>
  )
}

export default FollowUpDetailModal
