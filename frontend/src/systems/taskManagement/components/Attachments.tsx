// Attachments - Component for attachments display

import React from 'react'
import { FiPaperclip, FiEye, FiDownload, FiTrash2 } from 'react-icons/fi'
import type { Attachment } from '../../../core/services/taskService'

interface AttachmentsProps {
  attachments: Attachment[]
  loading: boolean
  onViewAttachment: (attachment: Attachment) => void
  onDeleteAttachment: (id: string) => void
}

const Attachments: React.FC<AttachmentsProps> = ({
  attachments,
  loading,
  onViewAttachment,
  onDeleteAttachment
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Attachments ({attachments?.length || 0})</h3>
      <div className="space-y-3">
        {attachments?.map((attachment: Attachment) => (
          <div key={attachment._id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FiPaperclip className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{attachment.filename}</p>
                  {attachment.size && (
                    <p className="text-xs text-gray-500 mt-1">{(attachment.size / 1024).toFixed(1)} KB</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onViewAttachment(attachment)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                >
                  <FiEye className="w-4 h-4" />
                  <span>View</span>
                </button>
                <a
                  href={attachment.url}
                  download={attachment.filename}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => onDeleteAttachment(attachment._id!)}
                  disabled={loading}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <FiTrash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {(!attachments || attachments.length === 0) && (
          <div className="text-center py-6 text-gray-500">
            <FiPaperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No attachments yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Attachments