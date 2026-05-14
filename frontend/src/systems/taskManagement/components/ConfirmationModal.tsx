// ConfirmationModal - Reusable confirmation dialog component
import React from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'

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

  const getIconColor = () => {
    switch (type) {
      case 'danger': return 'text-red-500'
      case 'warning': return 'text-orange-500'
      case 'info': return 'text-blue-500'
      default: return 'text-red-500'
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700'
      case 'warning': return 'bg-orange-600 hover:bg-orange-700'
      case 'info': return 'bg-blue-600 hover:bg-blue-700'
      default: return 'bg-red-600 hover:bg-red-700'
    }
  }

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 ${fullScreen ? 'flex items-center justify-center' : 'flex items-center justify-center p-3 md:p-4'}`}>
      <div className={`bg-white shadow-2xl ${fullScreen ? 'w-full h-full max-w-none max-h-none rounded-none flex flex-col' : 'w-full max-w-md rounded-xl'}`}>
        {/* Header */}
        <div className={`${fullScreen ? 'px-8 py-6' : 'px-6 py-4'} border-b border-gray-200 flex items-center justify-between`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-gray-100`}>
              <FiAlertTriangle className={`w-6 h-6 ${getIconColor()}`} />
            </div>
            <h3 className={`${fullScreen ? 'text-2xl' : 'text-lg'} font-semibold text-gray-900`}>{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className={`${fullScreen ? 'w-6 h-6' : 'w-5 h-5'}`} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 ${fullScreen ? 'px-8 py-8 flex items-center justify-center' : 'px-6 py-4'}`}>
          <div className={`${fullScreen ? 'text-center max-w-2xl' : ''}`}>
            <p className={`text-gray-600 ${fullScreen ? 'text-xl leading-relaxed' : 'text-sm leading-relaxed'}`}>{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className={`${fullScreen ? 'px-8 py-6 mt-auto' : 'px-6 py-4'} border-t border-gray-200 flex justify-center space-x-4`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`${fullScreen ? 'px-8 py-4 text-lg' : 'px-4 py-2 text-sm'} text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`${fullScreen ? 'px-8 py-4 text-lg' : 'px-4 py-2 text-sm'} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${getButtonColor()}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal