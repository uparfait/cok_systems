// AttachmentViewer - Component to view attachments based on file type

import React from 'react'
import { FiX, FiFile, FiImage, FiFileText, FiDownload, FiVideo, FiMusic } from 'react-icons/fi'
import type { Attachment } from '../../../core/services/taskService'

interface AttachmentViewerProps {
  attachment: Attachment
  onClose: () => void
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment, onClose }) => {
  
  const getFileType = (filename: string, type?: string): string => {
    // First check the type field (which contains our enum values from backend)
    if (type) {
      if (type === 'image') return 'image'
      if (type === 'video') return 'video'
      if (type === 'audio') return 'audio'
      if (type === 'document') {
        // For documents, check file extension to determine display method
        const ext = filename.toLowerCase().split('.').pop() || ''
        if (ext === 'pdf') return 'pdf'
        if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) return 'text'
        return 'document' // Office docs, etc. - download only
      }
    }

    // Fallback to file extension if type is not available
    const ext = filename.toLowerCase().split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio'
    if (['pdf'].includes(ext)) return 'pdf'
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'sql', 'csv'].includes(ext)) return 'text'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document'
    return 'other'
  }

  const fileType = getFileType(attachment.filename, attachment.type)
 // alert(`Determined file type: ${fileType} for filename: ${attachment.filename} with type field: ${attachment.type}`) // Debugging alert
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
      case 'video':
        return (
          <div className="flex justify-center">
            <video
              src={attachment.url}
              controls
              className="max-w-full max-h-[70vh]"
              style={{ maxHeight: '70vh' }}
            >
              <p className="text-gray-600">Your browser doesn't support HTML5 video.</p>
            </video>
          </div>
        )
      case 'audio':
        return (
          <div className="flex justify-center">
            <audio
              src={attachment.url}
              controls
              className="w-full max-w-md"
            >
              <p className="text-gray-600">Your browser doesn't support HTML5 audio.</p>
            </audio>
          </div>
        )
      case 'pdf':
      case 'text':
        // Only use iframe for PDFs and plain text files that browsers can display
        return (
          <div className="w-full h-[70vh]">
            <iframe
              src={attachment.url}
              className="w-full h-full border-0"
              title={attachment.filename}
            />
          </div>
        )
      case 'document':
        // For office documents and other complex documents, show download message
        return (
          <div className="text-center py-8">
            <FiFileText className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Document Preview Not Available</p>
            <p className="text-sm text-gray-500 mb-4">
              This document type cannot be previewed in the browser.
            </p>
            <a
              href={attachment.url}
              download={attachment.originalName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              Download File
            </a>
          </div>
        )
      default:
        return (
          <div className="text-center py-8">
            <FiFile className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Preview not available for this file type</p>
            <p className="text-sm text-gray-500 mt-2">
              This file type cannot be previewed in the browser.
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Use the download button to access the file.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] sm:w-[90vw] max-w-7xl max-h-[90vh] min-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3 pr-40 sm:pr-48">
            {fileType === 'image' && <FiImage className="w-5 h-5 text-green-600" />}
            {fileType === 'video' && <FiVideo className="w-5 h-5 text-purple-600" />}
            {fileType === 'audio' && <FiMusic className="w-5 h-5 text-indigo-600" />}
            {fileType === 'pdf' && <FiFileText className="w-5 h-5 text-red-600" />}
            {fileType === 'document' && <FiFileText className="w-5 h-5 text-orange-600" />}
            {fileType === 'text' && <FiFileText className="w-5 h-5 text-blue-600" />}
            {fileType === 'other' && <FiFile className="w-5 h-5 text-gray-600" />}
            <div className="min-w-0 flex-1 max-w-[calc(100vw-12rem)] sm:max-w-none">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{attachment.filename}</h3>
              {attachment.description && (
                <p className="text-sm text-gray-600 truncate hidden sm:block">{attachment.description}</p>
              )}
            </div>
          </div>
          <div className="absolute top-4 right-4 flex items-center space-x-1 sm:space-x-2">
            <a
              href={attachment.url}
              download={attachment.filename}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              title="Download file"
            >
              <FiDownload className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
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