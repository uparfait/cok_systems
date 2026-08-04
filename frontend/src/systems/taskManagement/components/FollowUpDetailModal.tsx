import React, { useState, useRef } from 'react'
import { FiX, FiPaperclip, FiDownload, FiEye } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  deleteEventAction,
  type EventAction
} from '../../../core/services/eventActionService'

interface FollowUpDetailModalProps {
  followup: EventAction
  onClose: () => void
  onUpdate: (updatedFollowUp?: EventAction) => void
  onDelete?: () => void
}

const FollowUpDetailModal: React.FC<FollowUpDetailModalProps> = ({ followup, onClose, onUpdate, onDelete }) => {
  const [viewingAttachment, setViewingAttachment] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 md:px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 break-words">
                {followup.title}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor(followup.currentStatus?.status || 'Pending') }}
                ></div>
                <span className="text-xs text-gray-500 capitalize">
                  {followup.currentStatus?.status || 'Pending'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-6">
            {followup.actionDescription && (
              <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700">Description</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {followup.actionDescription}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700">Assigned To</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {followup.assignedPerson?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {followup.assignedPerson?.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {followup.assignedPerson?.role} {followup.assignedPerson?.institution ? `• ${followup.assignedPerson.institution}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700">Due Date</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
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
            </div>

            {followup.statusHistory && followup.statusHistory.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700">Status History</h3>
                </div>
                <div className="p-4 space-y-3">
                  {followup.statusHistory.map((entry, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: getStatusColor(entry.status) }}
                      ></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {entry.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(entry.changedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
