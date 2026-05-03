// TaskDetailModal - Detailed task view with editing capabilities

import React, { useState } from 'react'
import { FiX, FiEdit, FiPlus, FiPaperclip, FiMessageSquare, FiClock, FiSave, FiTrash2, FiImage, FiDownload } from 'react-icons/fi'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  updateTask,
  addComment,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  getTaskProgress,
  getTaskStatusColor
} from '../../../core/services/taskService'
import type { Task } from '../../../core/services/taskService'

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
  onUpdate: () => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task: initialTask, onClose, onUpdate }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [task, setTask] = useState<Task>(initialTask)
  const [loadingStates, setLoadingStates] = useState({
    task: false,
    subtasks: false,
    comments: false
  })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: initialTask.title,
    dueDate: initialTask.dueDate.split('T')[0],
    dueTime: initialTask.dueDate.includes('T') ? initialTask.dueDate.split('T')[1].substring(0, 5) : '12:00'
  })

  // Subtask form
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)
  const [subtaskForm, setSubtaskForm] = useState({
    title: '',
    description: ''
  })

  // Comment form
  const [commentText, setCommentText] = useState('')

  // File viewer
  const [fileViewer, setFileViewer] = useState<{
    isOpen: boolean
    file: any
  }>({ isOpen: false, file: null })

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
    } catch (error: any) {
      showError(error?.message || 'Failed to update task')
    } finally {
      setLoadingStates(prev => ({ ...prev, task: false }))
    }
  }

  const handleAddSubtask = async () => {
    if (!subtaskForm.title.trim()) {
      showError('Subtask title is required')
      return
    }

    setLoadingStates(prev => ({ ...prev, subtasks: true }))
    try {
      await addSubtask(task._id!, {
        title: subtaskForm.title,
        description: subtaskForm.description
      })

      setSubtaskForm({ title: '', description: '' })
      setShowSubtaskForm(false)
      showSuccess('Subtask added successfully')
      onUpdate()
    } catch (error: any) {
      showError(error?.message || 'Failed to add subtask')
    } finally {
      setLoadingStates(prev => ({ ...prev, subtasks: false }))
    }
  }

  const handleUpdateSubtask = async (subtaskId: string, updates: any) => {
    setLoadingStates(prev => ({ ...prev, subtasks: true }))
    try {
      await updateSubtask(task._id!, subtaskId, updates)
      showSuccess('Subtask updated successfully')
      onUpdate()
    } catch (error: any) {
      showError(error?.message || 'Failed to update subtask')
    } finally {
      setLoadingStates(prev => ({ ...prev, subtasks: false }))
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return

    setLoadingStates(prev => ({ ...prev, subtasks: true }))
    try {
      await deleteSubtask(task._id!, subtaskId)
      showSuccess('Subtask deleted successfully')
      onUpdate()
    } catch (error: any) {
      showError(error?.message || 'Failed to delete subtask')
    } finally {
      setLoadingStates(prev => ({ ...prev, subtasks: false }))
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
    } catch (error: any) {
      showError(error?.message || 'Failed to add comment')
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

  const getFileType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image'
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) return 'video'
    if (['pdf'].includes(ext || '')) return 'pdf'
    if (['txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) return 'document'
    return 'other'
  }

  const handleFileClick = (attachment: any) => {
    const fileType = getFileType(attachment.filename)
    if (['image', 'video', 'pdf'].includes(fileType)) {
      setFileViewer({ isOpen: true, file: attachment })
    } else {
      // For documents and other files, download
      window.open(attachment.url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                task.status === 'Under-review' ? 'bg-gray-400' :
                task.status === 'In-progress' ? 'bg-blue-500' :
                'bg-green-500'
              }`}></div>
              {!editing ? (
                <h2 className="text-xl font-semibold text-gray-900">
                  {task.title}
                </h2>
              ) : (
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="text-xl font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1"
                  placeholder="Task title"
                />
              )}
            </div>
            <div className="flex items-center space-x-2">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiEdit className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTaskUpdate}
                    disabled={loadingStates.task}
                    className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loadingStates.task && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {loadingStates.task ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cover Image */}
              {task.taskConfig?.coverImage && (
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <img
                    src={task.taskConfig.coverImage}
                    alt="Task cover"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Subtasks ({task.subtasks?.length || 0})</h3>
                  <button
                    onClick={() => setShowSubtaskForm(!showSubtaskForm)}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Add Subtask</span>
                  </button>
                </div>

                {/* Subtask Form */}
                {showSubtaskForm && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Subtask title"
                        value={subtaskForm.title}
                        onChange={(e) => setSubtaskForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={subtaskForm.description}
                        onChange={(e) => setSubtaskForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleAddSubtask}
                          disabled={loadingStates.subtasks}
                          className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {loadingStates.subtasks && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          )}
                          Add
                        </button>
                        <button
                          onClick={() => setShowSubtaskForm(false)}
                          disabled={loadingStates.subtasks}
                          className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtask List */}
                <div className="space-y-2">
                  {task.subtasks?.map((subtask: any) => (
                    <div key={subtask._id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={subtask.status === 'Completed'}
                        onChange={(e) => handleUpdateSubtask(subtask._id!, { status: e.target.checked ? 'Completed' : 'Under-review' })}
                        disabled={loadingStates.subtasks}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <span className={`${subtask.status === 'Completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {subtask.title}
                        </span>
                        {subtask.description && (
                          <p className="text-xs text-gray-600 mt-1">{subtask.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSubtask(subtask._id!)}
                        disabled={loadingStates.subtasks}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!task.subtasks || task.subtasks.length === 0) && (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No subtasks yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Comments ({task.comments?.length || 0})</h3>
                <div className="space-y-4">
                  {task.comments?.map((comment: any) => (
                    <div key={comment._id} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-900">{comment.comment}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  ))}
                  {(!task.comments || task.comments.length === 0) && (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No comments yet</p>
                    </div>
                  )}
                </div>

                {/* Add Comment */}
                <div className="mt-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || loadingStates.comments}
                      className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loadingStates.comments ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <FiMessageSquare className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Task Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <FiClock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Due:</span>
                    {!editing ? (
                      <span className="text-sm text-gray-900">{formatDate(task.dueDate)}</span>
                    ) : (
                      <div className="flex space-x-2">
                        <input
                          type="date"
                          value={editForm.dueDate}
                          onChange={(e) => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <input
                          type="time"
                          value={editForm.dueTime}
                          onChange={(e) => setEditForm(prev => ({ ...prev, dueTime: e.target.value }))}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Progress Bar - Show for all tasks with subtasks */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Progress:</span>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{progress}%</span>
                          <span>{task.subtasks.filter((st: any) => st.status === 'Completed').length}/{task.subtasks.length}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              statusColor === 'red' ? 'bg-red-500' :
                              statusColor === 'orange' ? 'bg-orange-500' :
                              statusColor === 'yellow' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Attachments ({task.attachmentsFile?.length || 0})</h3>
                <div className="space-y-3">
                  {task.attachmentsFile?.map((attachment: any) => (
                    <div key={attachment._id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <FiPaperclip className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate block"
                            >
                              {attachment.filename}
                            </a>
                            {attachment.description && (
                              <p className="text-xs text-gray-500 mt-1">{attachment.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Click to download</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!task.attachmentsFile || task.attachmentsFile.length === 0) && (
                    <div className="text-center py-6 text-gray-500">
                      <FiPaperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No attachments yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailModal