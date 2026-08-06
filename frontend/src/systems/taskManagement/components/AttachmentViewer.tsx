// AttachmentViewer - Component to view attachments based on file type

import React from 'react'
import { FiX, FiFile, FiImage, FiFileText, FiDownload, FiVideo, FiMusic, FiPaperclip } from 'react-icons/fi'
import type { Attachment } from '../../../core/services/taskService'

const PRIMARY = "#056daa"
const NEUTRAL_DARK = "#333333"
const NEUTRAL_LIGHT = "#F7F9FB"
const WHITE = "#FFFFFF"
const GRAY_DISABLED = "#9E9E9E"
const DANGER = "#E74C3C"
const SUCCESS = "#4CAF50"
const fontHeading = "'Montserrat', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
}

interface AttachmentViewerProps {
  attachment: Attachment
  onClose: () => void
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment, onClose }) => {

  const getFileType = (filename: string, type?: string): string => {
    if (type) {
      if (type === 'image') return 'image'
      if (type === 'video') return 'video'
      if (type === 'audio') return 'audio'
      if (type === 'document') {
        const ext = filename.toLowerCase().split('.').pop() || ''
        if (ext === 'pdf') return 'pdf'
        if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) return 'text'
        return 'document'
      }
    }

    const ext = filename.toLowerCase().split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio'
    if (['pdf'].includes(ext)) return 'pdf'
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'sql', 'csv'].includes(ext)) return 'text'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document'
    return 'other'
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return <FiImage className="w-5 h-5" style={{ color: SUCCESS }} />
      case 'video': return <FiVideo className="w-5 h-5" style={{ color: '#9C27B0' }} />
      case 'audio': return <FiMusic className="w-5 h-5" style={{ color: '#3F51B5' }} />
      case 'pdf': return <FiFileText className="w-5 h-5" style={{ color: DANGER }} />
      case 'document': return <FiFileText className="w-5 h-5" style={{ color: '#F39C12' }} />
      case 'text': return <FiFileText className="w-5 h-5" style={{ color: PRIMARY }} />
      default: return <FiFile className="w-5 h-5" style={{ color: GRAY_DISABLED }} />
    }
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
        return (
          <div className="text-center py-8">
            <FiFileText className="w-12 h-12 mx-auto mb-4" style={{ color: DANGER }} />
            <p className="mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Document Preview Not Available</p>
            <p className="text-sm mb-4" style={{ color: GRAY_DISABLED }}>
              This document type cannot be previewed in the browser.
            </p>
            <a
              href={attachment.url}
              download={attachment.originalName}
              className="inline-flex items-center gap-2 px-4 py-2 cok-btn-primary"
              style={{ width: 'auto', textDecoration: 'none' }}
            >
              <FiDownload className="w-4 h-4" />
              Download File
            </a>
          </div>
        )
      default:
        return (
          <div className="text-center py-8">
            <FiFile className="w-12 h-12 mx-auto mb-4" style={{ color: GRAY_DISABLED }} />
            <p style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Preview not available for this file type</p>
            <p className="text-sm mt-2" style={{ color: GRAY_DISABLED }}>
              This file type cannot be previewed in the browser.
            </p>
            <p className="text-sm mt-1" style={{ color: GRAY_DISABLED }}>
              Use the download button to access the file.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white w-[95vw] max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header with cok-bg-primary */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 cok-bg-primary" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              {getFileIcon(fileType)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: WHITE, fontFamily: fontHeading }}>
                {attachment.originalName}
              </h2>
              {attachment.description && (
                <p className="text-xs truncate hidden sm:block" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {attachment.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <a
              href={attachment.url}
              download={attachment.originalName}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem', textDecoration: 'none' }}
            >
              <FiDownload className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default AttachmentViewer
