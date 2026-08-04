import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { FiArrowLeft, FiLoader, FiEdit, FiTrash2 } from 'react-icons/fi'
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader'
import {
  getTasks,
  updateTaskStatus,
  deleteTask,
  updateTask,
  type Task,
  type TaskStatus
} from '../../../core/services/taskService'

const PRIMARY = '#056daa'
const BORDER = '#E0E0E0'
const WHITE = '#FFFFFF'
const NEUTRAL_DARK = '#333333'
const fontHeading = "'Montserrat', sans-serif"

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { showSuccess, showError } = useToast()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login')
  }, [isAuthenticated, authLoading, navigate])

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    setError('')
    getTasks({ limit: 100, skip: 0 })
      .then((res: any) => {
        if (res.status) {
          const found = (res.data?.tasks || []).find((t: Task) => t._id === taskId)
          if (found) {
            setTask(found)
            setEditTitle(found.title)
            setEditDescription(found.description || '')
          } else {
            setError('Task not found')
          }
        } else {
          setError('Failed to load task')
        }
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false))
  }, [taskId])

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return
    setSaving(true)
    try {
      await updateTaskStatus(task._id!, newStatus)
      showSuccess(`Task moved to ${newStatus.replace('-', ' ')}`)
      setTask(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (error: any) {
      showError(error?.message || 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  const handleTitleSave = async () => {
    if (!task || !editTitle.trim()) return
    setSaving(true)
    try {
      const res: any = await updateTask(task._id!, { title: editTitle.trim() })
      setTask(res.data)
      setEditingTitle(false)
      showSuccess('Title updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update title')
    } finally {
      setSaving(false)
    }
  }

  const handleDescriptionSave = async () => {
    if (!task) return
    setSaving(true)
    try {
      const res: any = await updateTask(task._id!, { description: editDescription.trim() })
      setTask(res.data)
      setEditingDescription(false)
      showSuccess('Description updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update description')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    setSaving(true)
    try {
      await deleteTask(task._id!)
      showSuccess('Task deleted')
      navigate(-1)
    } catch (error: any) {
      showError(error?.message || 'Failed to delete task')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Under-review': return '#F39C12'
      case 'In-progress': return '#2563EB'
      case 'Completed': return '#4CAF50'
      default: return '#9E9E9E'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpiralLoader />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-sm text-gray-500" style={{ fontFamily: fontHeading }}>{error || 'Task not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold uppercase tracking-wider"
          style={{ backgroundColor: PRIMARY, fontFamily: fontHeading, borderRadius: 0 }}
        >
          <FiArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="bg-white w-full mb-4" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center"
              style={{ width: '40px', height: '40px', border: `1px solid ${BORDER}`, borderRadius: 0, backgroundColor: WHITE, cursor: 'pointer' }}
            >
              <FiArrowLeft className="w-4 h-4" style={{ color: NEUTRAL_DARK }} />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 uppercase tracking-wide" style={{ fontFamily: fontHeading }}>
                Task Details
              </h1>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
            style={{ fontFamily: fontHeading, borderRadius: 0 }}
          >
            <FiTrash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Title Section */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500" style={{ fontFamily: fontHeading }}>Title</h3>
            {!editingTitle && task.status !== 'Completed' && (
              <button onClick={() => setEditingTitle(true)} className="text-gray-400 hover:text-gray-600">
                <FiEdit className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingTitle ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 px-3 py-2 border text-sm"
                style={{ borderColor: BORDER, borderRadius: 0, fontFamily: fontHeading }}
                autoFocus
              />
              <button onClick={handleTitleSave} disabled={saving} className="px-3 py-2 bg-blue-600 text-white text-xs" style={{ borderRadius: 0 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditingTitle(false); setEditTitle(task.title); }} disabled={saving} className="px-3 py-2 border text-xs" style={{ borderColor: BORDER, borderRadius: 0 }}>
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: fontHeading }}>{task.title}</p>
          )}
        </div>

        {/* Description Section */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500" style={{ fontFamily: fontHeading }}>Description</h3>
            {!editingDescription && task.status !== 'Completed' && (
              <button onClick={() => setEditingDescription(true)} className="text-gray-400 hover:text-gray-600">
                <FiEdit className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingDescription ? (
            <div className="space-y-2">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border text-sm"
                style={{ borderColor: BORDER, borderRadius: 0, fontFamily: fontHeading }}
                rows={4}
              />
              <div className="flex gap-2">
                <button onClick={handleDescriptionSave} disabled={saving} className="px-3 py-2 bg-blue-600 text-white text-xs" style={{ borderRadius: 0 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setEditingDescription(false); setEditDescription(task.description || ''); }} disabled={saving} className="px-3 py-2 border text-xs" style={{ borderColor: BORDER, borderRadius: 0 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 whitespace-pre-wrap" style={{ fontFamily: fontHeading }}>
              {task.description || 'No description provided.'}
            </p>
          )}
        </div>

        {/* Status Section */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3" style={{ fontFamily: fontHeading }}>Change Status</h3>
          <div className="grid grid-cols-3 gap-3">
            {(['Under-review', 'In-progress', 'Completed'] as TaskStatus[]).map((status) => {
              const isActive = task.status === status
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={saving || isActive}
                  className="p-3 border-2 text-center transition-all disabled:opacity-50"
                  style={{
                    borderColor: isActive ? getStatusColor(status) : BORDER,
                    backgroundColor: isActive ? getStatusColor(status) + '10' : WHITE,
                    borderRadius: 0,
                    fontFamily: fontHeading
                  }}
                >
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: getStatusColor(status) }} />
                  <span className="text-xs font-bold uppercase block" style={{ color: isActive ? getStatusColor(status) : NEUTRAL_DARK }}>
                    {status.replace('-', ' ')}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: getStatusColor(status) }}>ACTIVE</span>
                  )}
                </button>
              )
            })}
          </div>
          {saving && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <FiLoader className="animate-spin" style={{ color: PRIMARY }} />
              <span className="text-xs" style={{ fontFamily: fontHeading }}>Updating...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskDetailPage
