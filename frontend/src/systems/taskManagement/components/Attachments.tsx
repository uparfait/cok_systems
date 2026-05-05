// Attachments - Component for attachments display

import React, { useState, useEffect, useRef } from 'react'
import { FiPaperclip, FiEye, FiDownload, FiTrash2, FiMoreVertical } from 'react-icons/fi'
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Attachments ({attachments?.length || 0})</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {attachments?.map((attachment: Attachment) => (
          <div key={attachment._id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow" title={attachment.originalName}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FiPaperclip className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={attachment.originalName}>
                    {attachment.originalName}
                  </p>
                  {attachment.size && (
                    <p className="text-xs text-gray-500 mt-1">{(attachment.size / 1024).toFixed(1)} KB</p>
                  )}
                </div>
              </div>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === attachment._id ? null : attachment._id!)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-50 transition-colors"
                >
                  <FiMoreVertical className="w-5 h-5" />
                </button>
                {openDropdown === attachment._id && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900 truncate" title={attachment.originalName}>
                        {attachment.originalName}
                      </p>
                      {attachment.size && (
                        <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          onViewAttachment(attachment)
                          setOpenDropdown(null)
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiEye className="w-4 h-4 mr-2" />
                        View
                      </button>
                      <a
                        href={attachment.url}
                        download={attachment.originalName}
                        onClick={() => setOpenDropdown(null)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FiDownload className="w-4 h-4 mr-2" />
                        Download
                      </a>
                      <button
                        onClick={() => {
                          onDeleteAttachment(attachment._id!)
                          setOpenDropdown(null)
                        }}
                        disabled={loading}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <FiTrash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
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