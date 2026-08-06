// ConfirmationModal - Reusable confirmation dialog component with CoK design

import React from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_DARK = '#333333'
const NEUTRAL_LIGHT = '#F7F9FB'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const DANGER = '#E74C3C'
const WARNING = '#F39C12'
const SUCCESS = '#4CAF50'
const fontHeading = "'Montserrat', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  loading?: boolean
  fullScreen?: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false,
  fullScreen = false
}) => {
  if (!isOpen) return null

  const [isConfirmHovered, setIsConfirmHovered] = React.useState(false)

  const getIconColor = () => {
    switch (type) {
      case 'danger': return DANGER
      case 'warning': return WARNING
      case 'info': return PRIMARY
      default: return DANGER
    }
  }

  const getConfirmButtonStyle = (): React.CSSProperties => {
    switch (type) {
      case 'danger':
        return {
          backgroundColor: DANGER,
          color: WHITE,
          border: 0,
          borderRadius: 0,
          padding: '0.6rem 1rem',
          width: '100%',
          cursor: 'pointer',
          fontFamily: fontHeading,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1,
        }
      case 'warning':
        return {
          backgroundColor: WARNING,
          color: WHITE,
          border: 0,
          borderRadius: 0,
          padding: '0.6rem 1rem',
          width: '100%',
          cursor: 'pointer',
          fontFamily: fontHeading,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1,
        }
      case 'info':
        return {
          backgroundColor: PRIMARY,
          color: WHITE,
          border: 0,
          borderRadius: 0,
          padding: '0.6rem 1rem',
          width: '100%',
          cursor: 'pointer',
          fontFamily: fontHeading,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1,
        }
      default:
        return {
          backgroundColor: DANGER,
          color: WHITE,
          border: 0,
          borderRadius: 0,
          padding: '0.6rem 1rem',
          width: '100%',
          cursor: 'pointer',
          fontFamily: fontHeading,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1,
        }
    }
  }

  const getConfirmButtonHoverStyle = (): React.CSSProperties => {
    switch (type) {
      case 'danger':
        return { backgroundColor: '#C62828' }
      case 'warning':
        return { backgroundColor: '#E65100' }
      case 'info':
        return { backgroundColor: '#045d94' }
      default:
        return { backgroundColor: '#C62828' }
    }
  }

  const confirmButtonStyle = {
    ...getConfirmButtonStyle(),
    ...(isConfirmHovered ? getConfirmButtonHoverStyle() : {}),
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white w-full max-w-md flex flex-col" style={{ borderRadius: 0 }}>
        {/* Header with cok-bg-primary */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 cok-bg-primary" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-3">
            <div className="p-2 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <FiAlertTriangle className="w-5 h-5" style={{ color: WHITE }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: WHITE, fontFamily: fontHeading }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex flex-col sm:flex-row gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={confirmButtonStyle}
            onMouseEnter={() => setIsConfirmHovered(true)}
            onMouseLeave={() => setIsConfirmHovered(false)}
            className="flex items-center justify-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? 'Processing...' : confirmText}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:flex-1 cok-btn-outlined"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
