import React from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import OverlayShell from '../../../core/components/overlay/OverlayShell'

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
    <OverlayShell
      title={
        <span className="flex items-center gap-2">
          <FiAlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: getIconColor() }} />
          <span className="truncate">{title}</span>
        </span>
      }
      onClose={onClose}
      busy={loading}
      width="sm"
      footer={
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
      }
    >
      <p className="text-sm leading-relaxed" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
        {message}
      </p>
    </OverlayShell>
  )
}

export default ConfirmationModal
