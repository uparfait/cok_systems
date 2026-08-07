import React, { useState, useRef } from 'react'
import { FiX, FiTrash2, FiPaperclip, FiMessageSquare, FiUpload, FiEye, FiCheckCircle, FiList, FiRefreshCcw } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import ConfirmationModal from './ConfirmationModal'
import TaskDetails from './TaskDetails'
import Checklists from './Checklists'
import Comments from './Comments'
import Attachments from './Attachments'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  updateTask,
  deleteTask,
  addComment,
  updateChecklist,
  deleteChecklist,
  addAttachment,
  deleteAttachment,
  addChecklist,
  getTaskProgress,
  getTaskStatusColor,
  updateTaskStatus
} from '../../../core/services/taskService'
import type { Task, TaskStatus, Attachment } from '../../../core/services/taskService'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const NEUTRAL_LIGHT = '#F7F9FB'
const NEUTRAL_DARK = '#333333'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const DANGER = '#E74C3C'
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

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
  onUpdate: (updatedTask?: Task) => void
  onDelete?: () => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task: initialTask, onClose, onUpdate, onDelete }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [task, setTask] = useState<Task>(initialTask)
  const [loadingStates, setLoadingStates] = useState({
    task: false,
    title: false,
    description: false,
    dates: false,
    checklists: false,
    comments: false,
    attachments: false,
    status: false,
    priority: false
  })
  const [editingSections, setEditingSections] = useState({
    title: false,
    description: false,
    dates: false,
    priority: false
  })
  const [editForms, setEditForms] = useState({
    title: initialTask.title,
    description: initialTask.description || '',
    priority: initialTask.priority || 'Medium',
    startDate: initialTask.startDate ? new Date(initialTask.startDate).toISOString().split('T')[0] : '',
    startTime: initialTask.startDate ? new Date(initialTask.startDate).toTimeString().slice(0, 5) : '12:00',
    dueDate: initialTask.dueDate ? new Date(initialTask.dueDate).toISOString().split('T')[0] : '',
    dueTime: initialTask.dueDate ? new Date(initialTask.dueDate).toTimeString().slice(0, 5) : '12:00'
  })
  const [commentText, setCommentText] = useState('')
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null)
  const [editingChecklist, setEditingChecklist] = useState<string | null>(null)
  const [checklistTitle, setChecklistTitle] = useState('')
  const [showAddChecklistForm, setShowAddChecklistForm] = useState(false)
  const [addChecklistForm, setAddChecklistForm] = useState({ title: '', items: [''] })
  const [newAttachments, setNewAttachments] = useState<File[]>([])
  const newAttachmentsRef = useRef<HTMLInputElement>(null)
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    type?: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  })
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false)

  const handleTitleUpdate = async () => {
    if (!editForms.title.trim()) {
      showError('Title cannot be empty')
      return
    }
    setLoadingStates(prev => ({ ...prev, title: true }))
    try {
      const updatedTask = await updateTask(task._id!, { title: editForms.title.trim() })
      setTask(updatedTask.data)
      setEditingSections(prev => ({ ...prev, title: false }))
      onUpdate(updatedTask.data)
      showSuccess('Title updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update title')
    } finally {
      setLoadingStates(prev => ({ ...prev, title: false }))
    }
  }

  const handleDescriptionUpdate = async () => {
    setLoadingStates(prev => ({ ...prev, description: true }))
    try {
      const updatedTask = await updateTask(task._id!, { description: editForms.description.trim() })
      setTask(updatedTask.data)
      setEditingSections(prev => ({ ...prev, description: false }))
      onUpdate(updatedTask.data)
      showSuccess('Description updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update description')
    } finally {
      setLoadingStates(prev => ({ ...prev, description: false }))
    }
  }

  const handlePriorityUpdate = async () => {
    setLoadingStates(prev => ({ ...prev, priority: true }))
    try {
      const updatedTask = await updateTask(task._id!, { priority: editForms.priority })
      setTask(updatedTask.data)
      setEditingSections(prev => ({ ...prev, priority: false }))
      onUpdate(updatedTask.data)
      showSuccess('Priority updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update priority')
    } finally {
      setLoadingStates(prev => ({ ...prev, priority: false }))
    }
  }

  const handleDatesUpdate = async () => {
    setLoadingStates(prev => ({ ...prev, dates: true }))
    try {
      const updateData: any = {}
      if (editForms.startDate && editForms.startTime) {
        updateData.startDate = new Date(`${editForms.startDate}T${editForms.startTime}`).toISOString()
      }
      if (editForms.dueDate && editForms.dueTime) {
        updateData.dueDate = new Date(`${editForms.dueDate}T${editForms.dueTime}`).toISOString()
      }
      if (Object.keys(updateData).length > 0) {
        const updatedTask = await updateTask(task._id!, updateData)
        setTask(updatedTask.data)
        setEditingSections(prev => ({ ...prev, dates: false }))
        onUpdate(updatedTask.data)
        showSuccess('Dates updated successfully')
      }
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update dates')
    } finally {
      setLoadingStates(prev => ({ ...prev, dates: false }))
    }
  }

  const handleMoveTaskStatus = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return
    setLoadingStates(prev => ({ ...prev, status: true }))
    try {
      const updatedTask = await updateTaskStatus(task._id!, newStatus)
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess(`Task moved to ${newStatus.replace('-', ' ')}`)
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to move task')
    } finally {
      setLoadingStates(prev => ({ ...prev, status: false }))
    }
  }

  const handleUpdateChecklistItem = async (checklistId: string, itemIndex: number, completed: boolean) => {
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      const updatedTask = await updateChecklist(task._id!, checklistId, { itemIndex, completed })
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess('Checklist item updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update checklist item')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleUpdateChecklistItemText = async (checklistId: string, itemIndex: number, text: string) => {
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      const updatedTask = await updateChecklist(task._id!, checklistId, { itemIndex, itemText: text })
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess('Checklist item updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update checklist item text')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleDeleteChecklistItem = async (checklistId: string, itemIndex: number) => {
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      const updatedTask = await updateChecklist(task._id!, checklistId, { deleteItemIndex: itemIndex })
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess('Checklist item deleted successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to delete checklist item')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleDeleteChecklist = async (checklistId: string) => {
    const checklist = task.checklists?.find(c => c._id === checklistId)
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Checklist',
      message: `Are you sure you want to delete the checklist "${checklist?.title || 'this checklist'}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }))
        setLoadingStates(prev => ({ ...prev, checklists: true }))
        try {
          const updatedTask = await deleteChecklist(task._id!, checklistId)
          setTask(updatedTask.data)
          onUpdate(updatedTask.data)
          showSuccess('Checklist deleted successfully')
        } catch (error: unknown) {
          showError((error as Error)?.message || 'Failed to delete checklist')
        } finally {
          setLoadingStates(prev => ({ ...prev, checklists: false }))
        }
      },
      type: 'danger'
    })
  }

  const handleEditChecklistTitle = (checklistId: string, currentTitle: string) => {
    setEditingChecklist(checklistId)
    setChecklistTitle(currentTitle)
  }

  const handleSaveChecklistTitle = async () => {
    if (!editingChecklist || !checklistTitle.trim()) return
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      const updatedTask = await updateChecklist(task._id!, editingChecklist, { title: checklistTitle.trim() })
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess('Checklist title updated successfully')
      setEditingChecklist(null)
      setChecklistTitle('')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update checklist title')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleCancelEditChecklist = () => {
    setEditingChecklist(null)
    setChecklistTitle('')
  }

  const handleAddChecklistItem = () => {
    setAddChecklistForm(prev => ({ ...prev, items: [...prev.items, ''] }))
  }

  const handleUpdateAddChecklistItem = (index: number, text: string) => {
    setAddChecklistForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? text : item)
    }))
  }

  const handleRemoveAddChecklistItem = (index: number) => {
    setAddChecklistForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleAddNewChecklist = async () => {
    if (!addChecklistForm.title.trim() || addChecklistForm.items.some(item => !item.trim())) {
      showError('Please fill all checklist fields')
      return
    }
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      const updatedTask = await addChecklist(task._id!, {
        title: addChecklistForm.title.trim(),
        items: addChecklistForm.items.filter(item => item.trim()).map(text => ({ text: text.trim() }))
      })
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      showSuccess('Checklist added successfully')
      setAddChecklistForm({ title: '', items: [''] })
      setShowAddChecklistForm(false)
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to add checklist')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    const attachment = task.attachmentsFile?.find(a => a._id === attachmentId)
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Attachment',
      message: `Are you sure you want to delete the attachment "${attachment?.originalName || 'this file'}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }))
        setLoadingStates(prev => ({ ...prev, attachments: true }))
        try {
          const updatedTask = await deleteAttachment(task._id!, attachmentId)
          setTask(updatedTask.data)
          onUpdate(updatedTask.data)
          showSuccess('Attachment deleted successfully')
        } catch (error: unknown) {
          showError((error as Error)?.message || 'Failed to delete attachment')
        } finally {
          setLoadingStates(prev => ({ ...prev, attachments: false }))
        }
      },
      type: 'danger'
    })
  }

  const handleUploadAttachments = async () => {
    if (newAttachments.length === 0) return
    setLoadingStates(prev => ({ ...prev, attachments: true }))
    try {
      const formData = new FormData()
      newAttachments.forEach((file) => {
        formData.append('attachments', file)
      })
      const updatedTask = await addAttachment(task._id!, formData)
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      setNewAttachments([])
      showSuccess('Attachments uploaded successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to upload attachments')
    } finally {
      setLoadingStates(prev => ({ ...prev, attachments: false }))
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !user?.userId) return
    setLoadingStates(prev => ({ ...prev, comments: true }))
    try {
      const updatedTask = await addComment(task._id!, user.userId, commentText.trim())
      setTask(updatedTask.data)
      onUpdate(updatedTask.data)
      setCommentText('')
      showSuccess('Comment added successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to add comment')
    } finally {
      setLoadingStates(prev => ({ ...prev, comments: false }))
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleClose = () => {
   // onUpdate(task)
    onClose()
  }

  const progress = task.status === 'Completed' && (!task.checklists || task.checklists.length === 0)
    ? 100
    : getTaskProgress(task)

  const statusColor = getTaskStatusColor(task)

  const allStatuses: TaskStatus[] = ['Under-review', 'In-progress', 'Completed']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header with cok-bg-primary */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 flex-shrink-0 cok-bg-primary" style={{ borderRadius: 0 }}>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-semibold truncate" style={{ color: WHITE, fontFamily: fontHeading }}>
              {task.title}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontHeading }}>Task</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              type="button"
              onClick={() => {
                setConfirmationModal({
                  isOpen: true,
                  title: 'Delete Task',
                  message: `Are you sure you want to delete the task "${task.title}"? This action cannot be undone and will permanently remove the task and all its data including attachments, comments, and checklists.`,
                  onConfirm: async () => {
                    setDeleteConfirmLoading(true)
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }))
                    try {
                      await deleteTask(task._id!)
                      showSuccess('Task deleted successfully')
                      if (onDelete) onDelete()
                    } catch (error: unknown) {
                      showError((error as Error)?.message || 'Failed to delete task')
                    } finally {
                      setDeleteConfirmLoading(false)
                    }
                    onClose()
                  },
                  type: 'danger'
                })
              }}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
              title="Delete task"
              disabled={deleteConfirmLoading}
            >
              {deleteConfirmLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiTrash2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 sm:px-6 py-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 overflow-hidden" style={{ borderRadius: 0 }}>
              <div
                className="h-full"
                style={{ width: `${progress}%`, backgroundColor: statusColor }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Status Move Select */}
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: WHITE }}>
          <label className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Move to:</label>
          <select
            value={task.status}
            onChange={(e) => handleMoveTaskStatus(e.target.value as TaskStatus)}
            disabled={loadingStates.status}
            className="cok-auth-input"
            style={{ width: 'auto', padding: '0.4rem 2.5rem 0.4rem 0.8rem', fontSize: '12px' }}
          >
            {allStatuses.map(status => (
              <option key={status} value={status}>{status.replace('-', ' ')}</option>
            ))}
          </select>
          {loadingStates.status && (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Main Content - Left Column */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                {/* Task Details Section */}
                <div className="border" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                  <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                    <FiList className="w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                    <h3 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Description</h3>
                  </div>
                  <div className="p-4 sm:p-6">
                    <TaskDetails
                      task={task}
                      editingSections={editingSections}
                      editForms={editForms}
                      loadingStates={loadingStates}
                      onEditSection={(section, value) => setEditingSections(prev => ({ ...prev, [section]: value }))}
                      onEditFormChange={(field, value) => setEditForms(prev => ({ ...prev, [field]: value }))}
                      onSaveDescription={handleDescriptionUpdate}
                      onSaveDates={handleDatesUpdate}
                      onSavePriority={handlePriorityUpdate}
                    />
                  </div>
                </div>

                {/* Checklists Section */}
                <div className="border" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                  <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                    <FiCheckCircle className="w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                    <h3 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Checklists</h3>
                  </div>
                  <div className="p-4 sm:p-6">
                    <Checklists
                      checklists={task.checklists || []}
                      editingChecklist={editingChecklist}
                      checklistTitle={checklistTitle}
                      showAddChecklistForm={showAddChecklistForm}
                      addChecklistForm={addChecklistForm}
                      loading={loadingStates.checklists}
                      taskStatus={task.status}
                      onEditChecklistTitle={handleEditChecklistTitle}
                      onSaveChecklistTitle={handleSaveChecklistTitle}
                      onCancelEditChecklist={handleCancelEditChecklist}
                      onDeleteChecklist={handleDeleteChecklist}
                      onUpdateChecklistItem={handleUpdateChecklistItem}
                      onUpdateChecklistItemText={handleUpdateChecklistItemText}
                      onDeleteChecklistItem={handleDeleteChecklistItem}
                      onConfirmDeleteItem={(checklistId, itemIndex, itemText) => {
                        setConfirmationModal({
                          isOpen: true,
                          title: 'Delete Checklist Item',
                          message: `Are you sure you want to delete the item "${itemText}"? This action cannot be undone.`,
                          onConfirm: () => {
                            setConfirmationModal(prev => ({ ...prev, isOpen: false }))
                            handleDeleteChecklistItem(checklistId, itemIndex)
                          },
                          type: 'danger'
                        })
                      }}
                      onShowAddChecklistForm={() => setShowAddChecklistForm(true)}
                      onAddChecklistItem={handleAddChecklistItem}
                      onUpdateAddChecklistItem={handleUpdateAddChecklistItem}
                      onRemoveAddChecklistItem={handleRemoveAddChecklistItem}
                      onAddNewChecklist={handleAddNewChecklist}
                      onCancelAddChecklist={() => {
                        setShowAddChecklistForm(false)
                        setAddChecklistForm({ title: '', items: [''] })
                      }}
                      onChecklistTitleChange={setChecklistTitle}
                      onAddChecklistFormChange={(field, value) => setAddChecklistForm(prev => ({ ...prev, [field]: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar - Right Column */}
              <div className="lg:col-span-1 space-y-4 sm:space-y-5">
                {/* Belongs To Section */}
                {task.belongs?.isBelongsTo && task.belongs.itBelongsTo && (
                  <div className="border" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                    <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                      <FiList className="w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                      <h3 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Belongs To</h3>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: PRIMARY }}>
                          {task.belongs.itBelongsTo.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                            {task.belongs.itBelongsTo.full_name}
                          </div>
                          {task.belongs.itBelongsTo.email || task.belongs.itBelongsTo.telephone && (
                            <div className="text-xs truncate" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                              {task.belongs.itBelongsTo.email || ''}, {task.belongs.itBelongsTo.telephone || ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div className="border" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                  <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                    <FiMessageSquare className="w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                    <h3 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Activity</h3>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                    <div className="p-4 sm:p-6">
                      <Comments
                        comments={task.comments || []}
                        formatDate={formatDate}
                      />
                    </div>
                  </div>
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div className="flex gap-2 pt-3">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        placeholder="Write a comment..."
                        className="flex-1 cok-auth-input"
                        style={{ fontFamily: fontHeading }}
                      />
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || loadingStates.comments}
                        className="cok-btn-primary"
                        style={{ width: 'auto', padding: '0.6rem 1rem' }}
                      >
                        {loadingStates.comments ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="border" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                    <div className="flex items-center gap-2">
                      <FiPaperclip className="w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                      <h3 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Attachments</h3>
                      <span className="text-xs" style={{ color: GRAY_DISABLED }}>({(task.attachmentsFile || []).length})</span>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="p-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div className="border p-4 text-center" style={{ borderColor: BORDER, borderRadius: 0 }}>
                      <FiUpload className="w-6 h-6 mx-auto mb-2" style={{ color: GRAY_DISABLED }} />
                      <p className="text-sm mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Drop files here or click to upload</p>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1 text-white text-xs" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading }}>
                        <FiUpload className="w-3 h-3" />
                        <span>Choose Files</span>
                        <input
                          ref={newAttachmentsRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              setNewAttachments(prev => [...prev, ...Array.from(e.target.files!)])
                            }
                          }}
                        />
                      </label>
                    </div>

                    {newAttachments.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                            Ready to upload ({newAttachments.length} file{newAttachments.length !== 1 ? 's' : ''})
                          </h4>
                          <button
                            type="button"
                            onClick={handleUploadAttachments}
                            disabled={loadingStates.attachments}
                            className="cok-btn-primary"
                            style={{ width: 'auto', padding: '0.6rem 1rem' }}
                          >
                            {loadingStates.attachments ? 'Uploading...' : 'Upload All'}
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {newAttachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-3 border p-3" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                              <div className="p-2 flex-shrink-0" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                                <FiPaperclip className="w-4 h-4" style={{ color: PRIMARY }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK }} title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
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
                                    }
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
                                  onClick={() => {
                                    setNewAttachments(prev => prev.filter((_, i) => i !== index))
                                  }}
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

                    {loadingStates.attachments && (
                      <div className="flex items-center justify-center py-3">
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6 max-h-[250px] overflow-y-auto custom-scrollbar">
                    <Attachments
                      attachments={task.attachmentsFile || []}
                      loading={loadingStates.attachments}
                      onViewAttachment={(attachment) => setViewingAttachment(attachment)}
                      onDeleteAttachment={handleDeleteAttachment}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
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

        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmationModal.onConfirm}
          title={confirmationModal.title}
          message={confirmationModal.message}
          type={confirmationModal.type}
          loading={deleteConfirmLoading}
        />
      </div>
    </div>
  )
}

export default TaskDetailModal
