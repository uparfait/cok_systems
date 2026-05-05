// TaskDetailModal.tsx
import React, { useState, useRef } from 'react'
import { FiX, FiEdit, FiPaperclip, FiMessageSquare, FiClock, FiTrash2, FiDownload, FiEye, FiUpload, FiCalendar, FiCheckCircle, FiList, FiImage } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import TaskDetails from './TaskDetails'
import Checklists from './Checklists'
import Comments from './Comments'
import Attachments from './Attachments'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  updateTask,
  addComment,
  updateChecklist,
  deleteChecklist,
  addAttachment,
  deleteAttachment,
  addChecklist,
  getTaskProgress,
  getTaskStatusColor
} from '../../../core/services/taskService'
import type { Task, TaskStatus, Attachment } from '../../../core/services/taskService'

interface ChecklistItem {
  text: string
  completed: boolean
  _id?: string
}

interface Checklist {
  _id?: string
  title: string
  items: ChecklistItem[]
}

interface Comment {
  _id?: string
  commenter: string
  comment: string
  createdAt: string
  updatedAt: string
}

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
  onUpdate: () => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task: initialTask, onClose, onUpdate }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [task] = useState<Task>(initialTask)
  const [loadingStates, setLoadingStates] = useState({
    task: false,
    checklists: false,
    comments: false,
    attachments: false
  })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: initialTask.title,
    dueDate: initialTask.dueDate ? initialTask.dueDate.split('T')[0] : '',
    dueTime: initialTask.dueDate && initialTask.dueDate.includes('T') ? initialTask.dueDate.split('T')[1].substring(0, 5) : '12:00'
  })

  // Comment form
  const [commentText, setCommentText] = useState('')

  // Attachment viewer
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null)

  // Checklist editing
  const [editingChecklist, setEditingChecklist] = useState<string | null>(null)
  const [checklistTitle, setChecklistTitle] = useState('')
  const [showAddChecklistForm, setShowAddChecklistForm] = useState(false)
  const [addChecklistForm, setAddChecklistForm] = useState({ title: '', items: [''] })

  // Task editing
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    status: 'Under-review' as TaskStatus,
    startDate: '',
    startTime: '12:00',
    dueDate: '',
    dueTime: '12:00'
  })

  // New attachments
  const [newAttachments, setNewAttachments] = useState<File[]>([])
  const newAttachmentsRef = useRef<HTMLInputElement>(null)

  const handleTaskUpdate = async () => {
    setLoadingStates(prev => ({ ...prev, task: true }))
    try {
      const dueDateTime = new Date(`${editForm.dueDate}T${editForm.dueTime}`)
      const updateData = {
        title: editForm.title,
        dueDate: dueDateTime.toISOString()
      }

      await updateTask(task._id!, updateData)
      setEditing(false)
      onUpdate()
      showSuccess('Task updated successfully')
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update task')
    } finally {
      setLoadingStates(prev => ({ ...prev, task: false }))
    }
  }

  const handleUpdateChecklistItem = async (checklistId: string, itemIndex: number, completed: boolean) => {
    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      await updateChecklist(task._id!, checklistId, { itemIndex, completed })
      showSuccess('Checklist item updated successfully')
      onUpdate()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update checklist item')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm('Are you sure you want to delete this checklist?')) return

    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      await deleteChecklist(task._id!, checklistId)
      showSuccess('Checklist deleted successfully')
      onUpdate()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to delete checklist')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleEditChecklistTitle = (checklistId: string, currentTitle: string) => {
    setEditingChecklist(checklistId)
    setChecklistTitle(currentTitle)
  }

  const handleSaveChecklistTitle = async () => {
    if (!editingChecklist || !checklistTitle.trim()) return

    setLoadingStates(prev => ({ ...prev, checklists: true }))
    try {
      await updateChecklist(task._id!, editingChecklist, { title: checklistTitle.trim() })
      showSuccess('Checklist title updated successfully')
      setEditingChecklist(null)
      setChecklistTitle('')
      onUpdate()
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
      await addChecklist(task._id!, {
        title: addChecklistForm.title.trim(),
        items: addChecklistForm.items.filter(item => item.trim()).map(text => ({ text: text.trim() }))
      })
      showSuccess('Checklist added successfully')
      setAddChecklistForm({ title: '', items: [''] })
      setShowAddChecklistForm(false)
      onUpdate()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to add checklist')
    } finally {
      setLoadingStates(prev => ({ ...prev, checklists: false }))
    }
  }

  const handleEditTask = () => {
    setIsEditingTask(true)
    setEditTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      startTime: task.startDate ? new Date(task.startDate).toTimeString().slice(0, 5) : '12:00',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      dueTime: task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '12:00'
    })
  }

  const handleSaveTask = async () => {
    if (!editTaskForm.title.trim()) {
      showError('Title is required')
      return
    }

    setLoadingStates(prev => ({ ...prev, task: true }))
    try {
      const updateData: any = {
        title: editTaskForm.title.trim(),
        description: editTaskForm.description.trim(),
        status: editTaskForm.status
      }

      if (editTaskForm.status === 'Under-review') {
        if (editTaskForm.startDate && editTaskForm.dueDate) {
          updateData.startDate = new Date(`${editTaskForm.startDate}T${editTaskForm.startTime}`).toISOString()
          updateData.dueDate = new Date(`${editTaskForm.dueDate}T${editTaskForm.dueTime}`).toISOString()
        }
      } else if (editTaskForm.status === 'In-progress') {
        if (editTaskForm.dueDate) {
          updateData.dueDate = new Date(`${editTaskForm.dueDate}T${editTaskForm.dueTime}`).toISOString()
        }
      } else if (editTaskForm.status === 'Completed') {
        if (editTaskForm.startDate && editTaskForm.dueDate) {
          updateData.startDate = new Date(`${editTaskForm.startDate}T${editTaskForm.startTime}`).toISOString()
          updateData.dueDate = new Date(`${editTaskForm.dueDate}T${editTaskForm.dueTime}`).toISOString()
        }
      }

      await updateTask(task._id!, updateData)
      showSuccess('Task updated successfully')
      setIsEditingTask(false)
      onUpdate()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to update task')
    } finally {
      setLoadingStates(prev => ({ ...prev, task: false }))
    }
  }

  const handleCancelEditTask = () => {
    setIsEditingTask(false)
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return

    setLoadingStates(prev => ({ ...prev, attachments: true }))
    try {
      await deleteAttachment(task._id!, attachmentId)
      showSuccess('Attachment deleted successfully')
      onUpdate()
    } catch (error: unknown) {
      showError((error as Error)?.message || 'Failed to delete attachment')
    } finally {
      setLoadingStates(prev => ({ ...prev, attachments: false }))
    }
  }

  const handleUploadAttachments = async () => {
    if (newAttachments.length === 0) return

    setLoadingStates(prev => ({ ...prev, attachments: true }))
    try {
      const formData = new FormData()
      newAttachments.forEach((file) => {
        formData.append('attachments', file)
      })

      await addAttachment(task._id!, formData)
      setNewAttachments([])
      showSuccess('Attachments uploaded successfully')
      onUpdate()
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
      await addComment(task._id!, user.userId, commentText.trim())
      setCommentText('')
      showSuccess('Comment added successfully')
      onUpdate()
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

  const progress = getTaskProgress(task)
  const statusColor = getTaskStatusColor(task)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden">
        {/* -style Header */}
        <div className="px-4 md:px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isEditingTask ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTaskForm.title}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full text-xl font-semibold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    placeholder="Task title"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 break-words">
                    {task.title}
                  </h2>
                  {task.status !== 'Completed' && !isEditingTask && (
                    <button
                      onClick={handleEditTask}
                      className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                      title="Edit task"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          {progress > 0 && progress < 100 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: statusColor }}
                />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* Content area with clean  layout */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Main Content - Left Column */}
              <div className="lg:col-span-2 space-y-5">
                {/* Task Details Section */}
                <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <h3 className="text-sm font-medium text-gray-700">Details</h3>
                  </div>
                  <div className="p-4">
                    <TaskDetails
                      task={task}
                      isEditing={isEditingTask}
                      editForm={editTaskForm}
                      onEditFormChange={(field, value) => setEditTaskForm(prev => ({ ...prev, [field]: value }))}
                      loading={loadingStates.task}
                    />
                  </div>
                </div>

                {/* Checklists Section */}
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

              {/* Sidebar - Right Column */}
              <div className="lg:col-span-1 space-y-5">
                {/* Comments Section -  style */}
                <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                    <FiMessageSquare className="w-3.5 h-3.5 text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-700">Activity</h3>
                  </div>
                  <div className="p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <Comments
                      comments={task.comments || []}
                      formatDate={formatDate}
                    />
                    {/* Add Comment Input */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={!commentText.trim() || loadingStates.comments}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiPaperclip className="w-3.5 h-3.5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-700">Attachments</h3>
                      <span className="text-xs text-gray-400">({(task.attachmentsFile || []).length})</span>
                    </div>
                    {/* Upload button -  style inline */}
                    <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <FiUpload className="w-3 h-3" />
                      <span>Add</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            setNewAttachments(Array.from(e.target.files))
                            handleUploadAttachments()
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="p-3 max-h-[250px] overflow-y-auto custom-scrollbar">
                    <Attachments
                      attachments={task.attachmentsFile || []}
                      loading={loadingStates.attachments}
                      onViewAttachment={(attachment) => setViewingAttachment(attachment)}
                      onDeleteAttachment={handleDeleteAttachment}
                    />
                    {newAttachments.length > 0 && !loadingStates.attachments && (
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        <span>{newAttachments.length} file(s) selected</span>
                        <button onClick={handleUploadAttachments} className="text-blue-600 hover:text-blue-700">
                          Upload
                        </button>
                      </div>
                    )}
                    {loadingStates.attachments && (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata - Due date, etc */}
                {task.dueDate && (
                  <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                      <FiClock className="w-3.5 h-3.5 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-700">Timeline</h3>
                    </div>
                    <div className="p-3 text-sm text-gray-600">
                      <div className="flex items-center justify-between">
                        <span>Due Date:</span>
                        <span className="font-medium">
                          {new Date(task.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      {task.startDate && (
                        <div className="flex items-center justify-between mt-1">
                          <span>Start Date:</span>
                          <span className="font-medium">
                            {new Date(task.startDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {viewingAttachment && <AttachmentViewer attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
      </div>

     
    </div>
  )
}

export default TaskDetailModal