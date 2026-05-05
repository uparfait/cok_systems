// TaskDetailModal - Detailed task view with editing capabilities

import React, { useState, useRef } from 'react'
import { FiX, FiEdit, FiPaperclip, FiMessageSquare, FiClock, FiTrash2, FiDownload, FiEye, FiUpload, FiCalendar } from 'react-icons/fi'
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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'In-progress': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const progress = getTaskProgress(task)
  const statusColor = getTaskStatusColor(task)





  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] md:w-[90vw] max-w-7xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200 flex-shrink-0 sticky top-0 bg-white z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
             
                <div>
                   <h2 className="text-2xl font-bold text-gray-900 break-words">{task.title}</h2>
                 </div>
            
            </div>
            <div className="flex items-center space-x-3">
              {isEditingTask ? (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveTask}
                    disabled={loadingStates.task}
                    className="px-3 py-1 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loadingStates.task && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditTask}
                    disabled={loadingStates.task}
                    className="px-3 py-1 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
      ) : (
        <div className="contents">
          <div className={'px-3 py-1 rounded-full text-sm font-medium ' + getStatusClass(task.status)}>
            {task.status.replace('-', ' ')}
          </div>
          {task.status !== 'Completed' && (
            <button
              onClick={handleEditTask}
              className="px-3 py-1 text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
            >
              Edit Task
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>
      )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <TaskDetails
                task={task}
                isEditing={isEditingTask}
                editForm={editTaskForm}
                onEditFormChange={(field, value) => setEditTaskForm(prev => ({ ...prev, [field]: value }))}
                loading={loadingStates.task}
              />

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

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Comments
                comments={task.comments || []}
                formatDate={formatDate}
              />

              <Attachments
                attachments={task.attachmentsFile || []}
                loading={loadingStates.attachments}
                onViewAttachment={(attachment) => setViewingAttachment(attachment)}
                onDeleteAttachment={handleDeleteAttachment}
              />
        </div>
      </div>
    </div>

    {viewingAttachment && <AttachmentViewer attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
  </div>
      </div>

      {viewingAttachment && <AttachmentViewer attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
    </div>
  )
}

export default TaskDetailModal