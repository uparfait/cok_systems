// CreateTaskModal - Modal for creating new tasks

import React, { useState, useRef, useEffect } from 'react'
import { FiX, FiCalendar, FiUpload, FiBell } from 'react-icons/fi'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { createTask } from '../../../core/services/taskService'
import type { TaskStatus } from '../../../core/services/taskService'

interface CreateTaskModalProps {
  onClose: () => void
  onSuccess: () => void
  TaskStatus: string
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSuccess, TaskStatus }) => {
  const { user } = useAuth()
  const { showError } = useToast()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus as TaskStatus,
    startDate: '',
    startTime: '12:00',
    dueDate: '',
    dueTime: '12:00',
    notifyDate: '',
    notifyTime: '12:00'
  })

  const [attachments, setAttachments] = useState<File[]>([])
  const attachmentsRef = useRef<HTMLInputElement>(null)

  // Update form data when TaskStatus prop changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      status: TaskStatus as TaskStatus
    }))
  }, [TaskStatus])
  const [checklists, setChecklists] = useState<Array<{ title: string; items: Array<{ text: string; completed: boolean }> }>>([])
  const [showChecklistForm, setShowChecklistForm] = useState(false)
  const [editingChecklistIndex, setEditingChecklistIndex] = useState<number | null>(null)
  const [checklistForm, setChecklistForm] = useState({ title: '', items: [{ text: '', completed: false }] })

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

    for (const checklist of checklists) {
      if (!checklist.title.trim()) {
        showError('All checklists must have a title')
        return
      }
      if (checklist.items.length === 0 || checklist.items.some(item => !item.text.trim())) {
        showError('Each checklist must have at least one item with text')
        return
      }
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
        description: formData.description.trim(),
        status: formData.status,
        taskConfig: {
          notifyDateTime: formData.notifyDate && formData.notifyTime
            ? new Date(`${formData.notifyDate}T${formData.notifyTime}`).toISOString()
            : null
        },
        checklists: checklists.map(c => ({ title: c.title, items: c.items.map(item => ({ text: item.text.trim(), completed: item.completed })) })),
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

      // Add attachments
      attachments.forEach((file) => {
        formDataToSend.append(`attachments`, file)
      })

      await createTask(formDataToSend)
      onSuccess()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to create task')
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

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const addChecklistItem = () => {
    setChecklistForm(prev => ({ ...prev, items: [...prev.items, { text: '', completed: false }] }))
  }

  const updateChecklistItem = (index: number, text: string) => {
    setChecklistForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, text } : item)
    }))
  }

  const toggleChecklistItemCompleted = (index: number) => {
    setChecklistForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, completed: !item.completed } : item)
    }))
  }

  const removeChecklistItem = (index: number) => {
    setChecklistForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleAddChecklist = () => {
    if (!checklistForm.title.trim() || checklistForm.items.some(item => !item.text.trim())) {
      showError('Please fill all checklist fields')
      return
    }

    const newChecklist = {
      title: checklistForm.title.trim(),
      items: checklistForm.items.filter(item => item.text.trim()).map(item => ({
        text: item.text.trim(),
        completed: item.completed
      }))
    }

    if (editingChecklistIndex !== null) {
      // Edit existing checklist
      setChecklists(prev => prev.map((checklist, index) =>
        index === editingChecklistIndex ? newChecklist : checklist
      ))
    } else {
      // Add new checklist
      setChecklists(prev => [...prev, newChecklist])
    }

    setChecklistForm({ title: '', items: [{ text: '', completed: false }] })
    setShowChecklistForm(false)
    setEditingChecklistIndex(null)
  }

  const removeChecklist = (index: number) => {
    setChecklists(prev => prev.filter((_, i) => i !== index))
  }

  const editChecklist = (index: number) => {
    const checklist = checklists[index]
    setChecklistForm({
      title: checklist.title,
      items: checklist.items.map(item => ({ text: item.text, completed: item.completed }))
    })
    setEditingChecklistIndex(index)
    setShowChecklistForm(true)
  }

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task description"
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

          {/* Checklists */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Checklists</label>
              <button
                type="button"
                onClick={() => setShowChecklistForm(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Checklist
              </button>
            </div>
            {checklists.length > 0 && (
              <div className="space-y-3 mb-4">
                {checklists.map((checklist, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{checklist.title}</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {checklist.items.filter(item => item.completed).length}/{checklist.items.length} completed
                        </span>
                        <button
                          type="button"
                          onClick={() => editChecklist(index)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Edit checklist"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChecklist(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove checklist"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {checklist.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {
                              // Update the checklist item completion status directly
                              setChecklists(prev => prev.map((cl, clIndex) =>
                                clIndex === index
                                  ? {
                                      ...cl,
                                      items: cl.items.map((it, itIndex) =>
                                        itIndex === itemIndex ? { ...it, completed: !it.completed } : it
                                      )
                                    }
                                  : cl
                              ))
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Checklist Form */}
            {showChecklistForm && (
              <div className="bg-gray-50 rounded-lg p-4 mt-2 border border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Title</label>
                    <input
                      type="text"
                      placeholder="Enter checklist title"
                      value={checklistForm.title}
                      onChange={(e) => setChecklistForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                    <div className="space-y-2">
                      {checklistForm.items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-gray-200">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklistItemCompleted(index)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Enter item text"
                            value={item.text}
                            onChange={(e) => updateChecklistItem(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {checklistForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove item"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                    >
                      <span>+</span>
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="flex space-x-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleAddChecklist}
                      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingChecklistIndex !== null ? 'Update Checklist' : 'Add Checklist'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChecklistForm(false)
                        setChecklistForm({ title: '', items: [{ text: '', completed: false }] })
                        setEditingChecklistIndex(null)
                      }}
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
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