// CreateTaskModal - Modal for creating new tasks

import React, { useState, useRef } from 'react'
import { FiX, FiCalendar, FiFlag, FiUpload, FiBell, FiImage } from 'react-icons/fi'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { createTask } from '../../../core/services/taskService'
import type { Task, TaskStatus } from '../../../core/services/taskService'

interface CreateTaskModalProps {
  onClose: () => void
  onSuccess: () => void
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth()
  const { showError } = useToast()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    status: 'Under-review' as TaskStatus,
    startDate: '',
    startTime: '12:00',
    dueDate: '',
    dueTime: '12:00',
    notifyDate: '',
    notifyTime: '12:00'
  })

  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState<string>('')
  const [attachments, setAttachments] = useState<File[]>([])
  const coverImageRef = useRef<HTMLInputElement>(null)
  const attachmentsRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.userId) {
      showError('User not authenticated')
      return
    }

    if (!formData.title.trim()) {
      showError('Title is required')
      return
    }

    // Validation based on status
    if (formData.status === 'Under-review') {
      if (!formData.startDate || !formData.dueDate) {
        showError('Both start and end dates are required for Under-review tasks')
        return
      }
    }

    if (formData.status === 'In-progress' && !formData.dueDate) {
      showError('End date is required for In-progress tasks')
      return
    }

    if (formData.status === 'Completed') {
      if (!formData.startDate || !formData.dueDate) {
        showError('Both start and end dates are required for Completed tasks')
        return
      }
    }

    setLoading(true)

    try {
      const taskData: any = {
        belongs: { isBelongsTo: false },
        incharge: user.userId,
        title: formData.title.trim(),
        status: formData.status,
        taskConfig: {
          notifyDateTime: formData.notifyDate && formData.notifyTime
            ? new Date(`${formData.notifyDate}T${formData.notifyTime}`).toISOString()
            : null
        },
        subtasks: [],
        comments: [],
        attachmentsFile: []
      }

      // Set dates based on status
      if (formData.status === 'Under-review') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
        // For under-review tasks, also store start date in taskConfig
        taskData.taskConfig.startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString()
      } else if (formData.status === 'In-progress') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
      } else if (formData.status === 'Completed') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
        // For completed tasks, also store start date in taskConfig
        taskData.taskConfig.startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString()
      }

      // Create FormData for file uploads
      const formDataToSend = new FormData()

      // Add task data
      formDataToSend.append('taskData', JSON.stringify(taskData))

      // Add cover image
      if (coverImage) {
        formDataToSend.append('coverImage', coverImage)
      }

      // Add attachments
      attachments.forEach((file, index) => {
        formDataToSend.append(`attachments`, file)
      })

      await createTask(formDataToSend)
      onSuccess()
    } catch (error: any) {
      showError(error?.message || 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setCoverImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const removeCoverImage = () => {
    setCoverImage(null)
    setCoverImagePreview('')
    if (coverImageRef.current) {
      coverImageRef.current.value = ''
    }
  }

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value as TaskStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Under-review">Under Review</option>
              <option value="In-progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>



          {/* Date Fields Based on Status */}
          {formData.status === 'Under-review' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start & End Dates *
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      min={today}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Start date"
                      required
                    />
                  </div>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      min={today}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="End date"
                      required
                    />
                  </div>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => handleInputChange('dueTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {formData.status === 'In-progress' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    min={today}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => handleInputChange('dueTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          {formData.status === 'Completed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start & End Dates *
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Start date"
                      required
                    />
                  </div>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="End date"
                      required
                    />
                  </div>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => handleInputChange('dueTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image
            </label>
            <div className="space-y-2">
              <input
                ref={coverImageRef}
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => coverImageRef.current?.click()}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FiImage className="w-4 h-4" />
                <span>{coverImage ? 'Change Cover Image' : 'Add Cover Image'}</span>
              </button>
              {coverImagePreview && (
                <div className="relative">
                  <img
                    src={coverImagePreview}
                    alt="Cover preview"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeCoverImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachments
            </label>
            <div className="space-y-2">
              <input
                ref={attachmentsRef}
                type="file"
                multiple
                onChange={handleAttachmentsChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => attachmentsRef.current?.click()}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FiUpload className="w-4 h-4" />
                <span>Add Attachments</span>
              </button>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notification Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiBell className="inline w-4 h-4 mr-1" />
              Notification Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={formData.notifyDate}
                  onChange={(e) => handleInputChange('notifyDate', e.target.value)}
                  min={today}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notification date"
                />
              </div>
              <input
                type="time"
                value={formData.notifyTime}
                onChange={(e) => handleInputChange('notifyTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave empty to disable notifications</p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {loading ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateTaskModal