import React, { useState, useRef, useEffect } from 'react'
import { FiX, FiCalendar, FiUpload, FiEye, FiFileText, FiType, FiList, FiTag, FiClock, FiPaperclip, FiCheckSquare, FiTrash2, FiPlus } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import type { Attachment } from '../../../core/services/taskService'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { createTask } from '../../../core/services/taskService'
import type { TaskStatus } from '../../../core/services/taskService'

const PRIMARY = "#056daa"
const SUCCESS = "#4CAF50"
const DANGER = "#E74C3C"
const NEUTRAL_LIGHT = "#F7F9FB"
const NEUTRAL_DARK = "#333333"
const WHITE = "#FFFFFF"
const GRAY_DISABLED = "#9E9E9E"
const fontHeading = "'Montserrat', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
}

const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
}

interface CreateTaskModalProps {
  onClose: () => void
  onSuccess: () => void
  TaskStatus: string
  belongs?: {
    isBelongsTo: boolean
    itBelongsTo?: string
  }
  belongsToName?: string
  belongsToEmail?: string
  belongstoTelephone?: string
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSuccess, TaskStatus, belongs, belongsToName, belongsToEmail, belongstoTelephone }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()

  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus as TaskStatus,
    priority: 'Medium',
    startDate: '',
    startTime: '12:00',
    dueDate: '',
    dueTime: '12:00',
    notifyDate: '',
    notifyTime: '12:00'
  })

  const [attachments, setAttachments] = useState<File[]>([])
  const attachmentsRef = useRef<HTMLInputElement>(null)
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null)

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
        belongs: belongs || { isBelongsTo: false },
        incharge: user.userId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        taskConfig: {
          notifyDateTime: formData.notifyDate && formData.notifyTime
            ? new Date(`${formData.notifyDate}T${formData.notifyTime}`).toISOString()
            : null
        },
        checklists: checklists.map(c => ({ title: c.title, items: c.items.map(item => ({ text: item.text.trim(), completed: item.completed })) })),
        comments: [],
        attachmentsFile: []
      }

      if (formData.status === 'Under-review') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
        taskData.taskConfig.startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString()
      } else if (formData.status === 'In-progress') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
      } else if (formData.status === 'Completed') {
        taskData.dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`).toISOString()
        taskData.taskConfig.startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString()
      }

      const formDataToSend = new FormData()
      formDataToSend.append('taskData', JSON.stringify(taskData))

      attachments.forEach((file) => {
        formDataToSend.append(`attachments`, file)
      })

      await createTask(formDataToSend)
      showSuccess('Task created successfully')
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

  const handleAttachmentsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadLoading(true)
    try {
      await Promise.all(files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
      }))

      setAttachments(prev => [...prev, ...files])
    } catch (error) {
      showError('Failed to process attachments')
    } finally {
      setUploadLoading(false)
      if (attachmentsRef.current) {
        attachmentsRef.current.value = ''
      }
    }
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
    setChecklistForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
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
      setChecklists(prev => prev.map((checklist, index) =>
        index === editingChecklistIndex ? newChecklist : checklist
      ))
    } else {
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

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header with cok-bg-primary */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h2 className="text-xl font-semibold" style={{ color: WHITE, fontFamily: fontHeading, letterSpacing: '0.5px' }}>
            Create New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Belongs to note */}
        {belongs?.isBelongsTo && belongsToName && (
          <div className="px-6 py-3" style={{ backgroundColor: '#EAF6FC', borderBottom: '1px solid #056daa' }}>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium" style={{ color: '#045d94', fontFamily: fontHeading, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                This task belongs to:
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: PRIMARY }}>
                  {belongsToName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{belongsToName}</div>
                  {belongsToEmail || belongstoTelephone && (
                    <div className="text-xs" style={{ color: GRAY_DISABLED }}>{belongsToEmail || ''}, {belongstoTelephone || ''}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>
              Title <span style={{ color: DANGER }}>*</span>
            </label>
            <div className="relative">
              <FiType className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="cok-auth-input"
                placeholder="Enter task title"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>
              Description
            </label>
            <div className="relative">
              <FiFileText className="absolute left-3 top-3 w-4 h-4" style={{ color: GRAY_DISABLED }} />
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="cok-auth-input"
                style={{ paddingLeft: '40px', minHeight: '80px' }}
                placeholder="Enter task description"
              />
            </div>
          </div>

          {/* Status and Priority - Row on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                Status
              </label>
              <div className="relative">
                <FiList className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value as TaskStatus)}
                  className="cok-auth-input"
                >
                  <option value="Under-review">Under Review</option>
                  <option value="In-progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                Priority
              </label>
              <div className="relative">
                <FiTag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="cok-auth-input"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date Fields Based on Status */}
          {formData.status === 'Under-review' && (
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                Start & End Dates <span style={{ color: DANGER }}>*</span>
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      min={today}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      min={today}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => handleInputChange('dueTime', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {formData.status === 'In-progress' && (
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                End Date <span style={{ color: DANGER }}>*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    min={today}
                    className="cok-auth-input"
                    required
                  />
                </div>
                <div className="relative">
                  <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => handleInputChange('dueTime', e.target.value)}
                    className="cok-auth-input"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {formData.status === 'Completed' && (
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                Start & End Dates <span style={{ color: DANGER }}>*</span>
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => handleInputChange('dueTime', e.target.value)}
                      className="cok-auth-input"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>
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
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 cursor-pointer"
                style={buttonBaseStyle}
              >
                {uploadLoading ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiUpload className="w-4 h-4" style={{ color: PRIMARY }} />
                )}
                <span style={{ color: NEUTRAL_DARK }}>
                  {uploadLoading ? 'Processing...' : 'Add Attachments'}
                </span>
              </button>
              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      Ready to upload ({attachments.length} file{attachments.length !== 1 ? 's' : ''})
                    </h4>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 border p-3" style={{ borderRadius: 0, borderColor: '#E0E0E0', backgroundColor: WHITE }}>
                        <div className="p-2 flex-shrink-0" style={{ backgroundColor: '#FFF3E0' }}>
                          <FiPaperclip className="w-4 h-4" style={{ color: '#F39C12' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK }} title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                            {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const tempUrl = URL.createObjectURL(file)
                              const tempAttachment = {
                                _id: `temp-${index}`,
                                filename: file.name,
                                originalName: file.name,
                                url: tempUrl,
                                type: file.type,
                                size: file.size,
                                uploadedBy: '',
                                uploadedAt: new Date().toISOString(),
                                description: ''
                              } as Attachment
                              setViewingAttachment(tempAttachment)
                            }}
                            className="p-1.5 cursor-pointer"
                            style={{ color: GRAY_DISABLED }}
                            title="Preview file"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="p-1.5 cursor-pointer"
                            style={{ color: DANGER }}
                            title="Remove file"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Checklists - New Design */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm" style={labelStyle}>
                Checklists
              </label>
              <button
                type="button"
                onClick={() => setShowChecklistForm(true)}
                className="flex items-center gap-1 text-sm font-medium cursor-pointer"
                style={{ color: PRIMARY, fontFamily: fontHeading }}
              >
                <FiPlus className="w-4 h-4" />
                Add Checklist
              </button>
            </div>

            {/* Checklist Form */}
            {showChecklistForm && (
              <div className="border p-4 mt-2 mb-4" style={{ borderRadius: 0, backgroundColor: NEUTRAL_LIGHT, borderColor: '#E0E0E0' }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1" style={labelStyle}>
                      Checklist Title
                    </label>
                    <input
                      type="text"
                      placeholder="Enter checklist title"
                      value={checklistForm.title}
                      onChange={(e) => setChecklistForm(prev => ({ ...prev, title: e.target.value }))}
                      className="cok-auth-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={labelStyle}>
                      Items
                    </label>
                    <div className="space-y-2">
                      {checklistForm.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-3 border p-3" style={{ borderRadius: 0, backgroundColor: WHITE, borderColor: '#E0E0E0' }}>
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklistItemCompleted(index)}
                            className="w-4 h-4"
                            style={{ accentColor: PRIMARY }}
                          />
                          <input
                            type="text"
                            placeholder="Enter item text"
                            value={item.text}
                            onChange={(e) => updateChecklistItem(index, e.target.value)}
                            className="flex-1 cok-auth-input"
                          />
                          {checklistForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index)}
                              className="p-1 cursor-pointer"
                              style={{ color: DANGER }}
                              title="Remove item"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="mt-2 flex items-center gap-1 text-sm font-medium cursor-pointer"
                      style={{ color: PRIMARY, fontFamily: fontHeading }}
                    >
                      <FiPlus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #E0E0E0' }}>
                    <button
                      type="button"
                      onClick={handleAddChecklist}
                      className="cok-btn-primary"
                      style={{ width: 'auto', padding: '0.6rem 1rem' }}
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
                      className="cok-btn-outlined"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checklists List */}
            {checklists.length > 0 && (
              <div className="space-y-3 mb-4">
                {checklists.map((checklist, index) => (
                  <div key={index} className="border p-4" style={{ borderRadius: 0, backgroundColor: WHITE, borderColor: '#E0E0E0' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FiCheckSquare className="w-4 h-4" style={{ color: PRIMARY }} />
                        <h4 className="font-medium" style={{ color: NEUTRAL_DARK }}>{checklist.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5" style={{ backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED, fontFamily: fontHeading }}>
                          {checklist.items.filter(item => item.completed).length}/{checklist.items.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => editChecklist(index)}
                          className="p-1 cursor-pointer"
                          style={{ color: PRIMARY }}
                          title="Edit checklist"
                        >
                          <FiX className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChecklist(index)}
                          className="p-1 cursor-pointer"
                          style={{ color: DANGER }}
                          title="Remove checklist"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {checklist.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center gap-3 p-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {
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
                            className="w-4 h-4"
                            style={{ accentColor: PRIMARY }}
                          />
                          <span className={`text-sm flex-1 ${item.completed ? 'line-through' : ''}`} style={{ color: item.completed ? GRAY_DISABLED : NEUTRAL_DARK }}>
                            {item.text}
                          </span>
                          {item.completed && (
                            <span className="text-xs px-2 py-0.5" style={{ backgroundColor: '#E9F5EA', color: SUCCESS, fontFamily: fontHeading }}>
                              Done
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full cok-btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Creating Task...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full cok-btn-outlined"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {viewingAttachment && (
        <AttachmentViewer
          attachment={viewingAttachment}
          onClose={() => {
            if (viewingAttachment._id?.startsWith('temp-')) {
              URL.revokeObjectURL(viewingAttachment.url)
            }
            setViewingAttachment(null)
          }}
        />
      )}
    </div>
  )
}

export default CreateTaskModal
