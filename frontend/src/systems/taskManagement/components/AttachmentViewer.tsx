// AttachmentViewer - Component to view attachments based on file type

import React from 'react'
import { FiX, FiFile, FiImage, FiFileText, FiDownload } from 'react-icons/fi'
import type { Attachment } from '../../../core/services/taskService'

interface AttachmentViewerProps {
  attachment: Attachment
  onClose: () => void
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment, onClose }) => {
  const getFileType = (filename: string, mimeType?: string): string => {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image'
      if (mimeType === 'application/pdf') return 'pdf'
      if (mimeType.startsWith('text/')) return 'text'
    }
    const ext = filename.toLowerCase().split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
    if (['pdf'].includes(ext)) return 'pdf'
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) return 'text'
    return 'other'
  }

  const fileType = getFileType(attachment.filename, attachment.type)

  const renderContent = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex justify-center">
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        )
      case 'pdf':
        return (
          <div className="w-full h-[70vh]">
            <iframe
              src={attachment.url}
              className="w-full h-full border-0"
              title={attachment.filename}
            />
          </div>
        )
      case 'text':
        return (
          <div className="w-full h-full">
            <iframe
              src={attachment.url}
              className="w-full h-full border-0"
              title={attachment.filename}
            />
          </div>
        )
      default:
        return (
          <div className="text-center py-8">
            <FiFile className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Preview not available for this file type</p>
            <p className="text-sm text-gray-500 mt-2">Use download link to view content</p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90vw] max-w-7xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {fileType === 'image' && <FiImage className="w-5 h-5 text-green-600" />}
            {fileType === 'pdf' && <FiFileText className="w-5 h-5 text-red-600" />}
            {fileType === 'text' && <FiFileText className="w-5 h-5 text-blue-600" />}
            {fileType === 'other' && <FiFile className="w-5 h-5 text-gray-600" />}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 truncate">{attachment.filename}</h3>
              {attachment.description && (
                <p className="text-sm text-gray-600">{attachment.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={attachment.url}
              download={attachment.filename}
              className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default AttachmentViewer