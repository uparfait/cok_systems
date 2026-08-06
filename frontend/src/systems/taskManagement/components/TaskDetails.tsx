// TaskDetails - Component for task details editing with CoK design

import React from 'react'
import { FiCalendar, FiEdit, FiCheck, FiX, FiFlag } from 'react-icons/fi'

const PRIMARY = '#056daa'
const NEUTRAL_DARK = '#333333'
const NEUTRAL_LIGHT = '#F7F9FB'
const WHITE = '#FFFFFF'
const GRAY_DISABLED = '#9E9E9E'
const BORDER = '#E0E0E0'
const DANGER = '#E74C3C'
const SUCCESS = '#4CAF50'
const WARNING = '#F39C12'
const fontHeading = "'Montserrat', sans-serif"

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
}

interface TaskDetailsProps {
  task: any
  editingSections: {
    title: boolean
    description: boolean
    dates: boolean
    priority: boolean
  }
  editForms: {
    title: string
    description: string
    priority: string
    startDate: string
    startTime: string
    dueDate: string
    dueTime: string
  }
  loadingStates: {
    title: boolean
    description: boolean
    dates: boolean
    priority: boolean
  }
  onEditSection: (section: string, value: boolean) => void
  onEditFormChange: (field: string, value: string) => void
  onSaveDescription: () => void
  onSaveDates: () => void
  onSavePriority: () => void
}

const TaskDetails: React.FC<TaskDetailsProps> = ({
  task,
  editingSections,
  editForms,
  loadingStates,
  onEditSection,
  onEditFormChange,
  onSaveDescription,
  onSaveDates,
  onSavePriority
}) => {
  const getPriorityBadgeStyle = (priority: string): React.CSSProperties => {
    switch (priority) {
      case 'Low':
        return { backgroundColor: '#E9F5EA', color: SUCCESS }
      case 'Medium':
        return { backgroundColor: '#FFF8E1', color: WARNING }
      case 'High':
        return { backgroundColor: '#FFF3E0', color: '#FF7043' }
      case 'Urgent':
        return { backgroundColor: '#FFEBEE', color: DANGER }
      default:
        return { backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }
    }
  }

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
      <div className="space-y-4">
        {/* Description */}
        <div className="pl-4 sm:pl-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm" style={labelStyle}>
              Description
            </label>
            {!editingSections.description && (
              <button
                type="button"
                onClick={() => onEditSection('description', true)}
                className="p-1 cursor-pointer"
                style={{ color: GRAY_DISABLED }}
                title="Edit description"
              >
                <FiEdit className="w-3 h-3" />
              </button>
            )}
          </div>

          {editingSections.description ? (
            <div className="space-y-2">
              <textarea
                value={editForms.description}
                onChange={(e) => onEditFormChange('description', e.target.value)}
                rows={3}
                className="cok-auth-input"
                style={{ paddingLeft: '12px', minHeight: '80px' }}
                disabled={loadingStates.description}
                placeholder="Enter task description"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onSaveDescription}
                  disabled={loadingStates.description}
                  className="cok-btn-primary"
                  style={{ width: 'auto', padding: '0.6rem 1rem' }}
                >
                  {loadingStates.description ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditFormChange('description', task.description || '')
                    onEditSection('description', false)
                  }}
                  disabled={loadingStates.description}
                  className="cok-btn-outlined"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
              <p className="text-sm" style={{ color: NEUTRAL_DARK }}>{task.description || 'No description'}</p>
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="pl-4 sm:pl-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm" style={labelStyle}>
              Priority
            </label>
            {!editingSections.priority && (
              <button
                type="button"
                onClick={() => onEditSection('priority', true)}
                className="p-1 cursor-pointer"
                style={{ color: GRAY_DISABLED }}
                title="Edit priority"
              >
                <FiEdit className="w-3 h-3" />
              </button>
            )}
          </div>

          {editingSections.priority ? (
            <div className="space-y-2">
              <select
                value={editForms.priority}
                onChange={(e) => onEditFormChange('priority', e.target.value)}
                className="cok-auth-input"
                disabled={loadingStates.priority}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onSavePriority}
                  disabled={loadingStates.priority}
                  className="cok-btn-primary"
                  style={{ width: 'auto', padding: '0.6rem 1rem' }}
                >
                  {loadingStates.priority ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditFormChange('priority', task.priority || 'Medium')
                    onEditSection('priority', false)
                  }}
                  disabled={loadingStates.priority}
                  className="cok-btn-outlined"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FiFlag className="w-3 h-3" style={{ color: GRAY_DISABLED }} />
              <span
                className="text-xs px-2 py-0.5 inline-block"
                style={{
                  ...getPriorityBadgeStyle(task.priority || 'Medium'),
                  fontFamily: fontHeading,
                  borderRadius: 0,
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}
              >
                {task.priority || 'Medium'}
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="pl-4 sm:pl-6">
          <label className="block text-sm mb-1" style={labelStyle}>
            Status
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1" style={{
              backgroundColor: task.status === 'Completed' ? '#E9F5EA' : task.status === 'In-progress' ? '#EAF6FC' : NEUTRAL_LIGHT,
              color: task.status === 'Completed' ? SUCCESS : task.status === 'In-progress' ? PRIMARY : GRAY_DISABLED,
              fontFamily: fontHeading,
              borderRadius: 0
            }}>
              {task.status.replace('-', ' ')}
            </span>
          </div>
        </div>

        {/* Dates */}
        <div className="pl-4 sm:pl-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm" style={labelStyle}>
              Timeline
            </label>
            {!editingSections.dates && (
              <button
                type="button"
                onClick={() => onEditSection('dates', true)}
                className="p-1 cursor-pointer"
                style={{ color: GRAY_DISABLED }}
                title="Edit dates"
              >
                <FiEdit className="w-3 h-3" />
              </button>
            )}
          </div>

          {editingSections.dates ? (
            <div className="space-y-3 p-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
              <div>
                <label className="block text-xs mb-2" style={labelStyle}>
                  Start Date & Time
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={editForms.startDate}
                      onChange={(e) => onEditFormChange('startDate', e.target.value)}
                      className="cok-auth-input"
                      disabled={loadingStates.dates}
                    />
                  </div>
                  <input
                    type="time"
                    value={editForms.startTime}
                    onChange={(e) => onEditFormChange('startTime', e.target.value)}
                    className="cok-auth-input"
                    disabled={loadingStates.dates}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-2" style={labelStyle}>
                  {task.status === 'Completed' ? 'Completed Date & Time' : 'Due Date & Time'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="date"
                      value={editForms.dueDate}
                      onChange={(e) => onEditFormChange('dueDate', e.target.value)}
                      className="cok-auth-input"
                      disabled={loadingStates.dates}
                    />
                  </div>
                  <input
                    type="time"
                    value={editForms.dueTime}
                    onChange={(e) => onEditFormChange('dueTime', e.target.value)}
                    className="cok-auth-input"
                    disabled={loadingStates.dates}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                <button
                  type="button"
                  onClick={onSaveDates}
                  disabled={loadingStates.dates}
                  className="cok-btn-primary"
                  style={{ width: 'auto', padding: '0.6rem 1rem' }}
                >
                  {loadingStates.dates ? 'Saving...' : 'Save Dates'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditFormChange('startDate', task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '')
                    onEditFormChange('startTime', task.startDate ? new Date(task.startDate).toTimeString().slice(0, 5) : '12:00')
                    onEditFormChange('dueDate', task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
                    onEditFormChange('dueTime', task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '12:00')
                    onEditSection('dates', false)
                  }}
                  disabled={loadingStates.dates}
                  className="cok-btn-outlined"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
              {task.startDate && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Start:</span>
                  <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="text-xs ml-1" style={{ color: GRAY_DISABLED }}>
                      {new Date(task.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </span>
                </div>
              )}
              {task.dueDate && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-xs uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    {task.status === 'Completed' ? 'Completed:' : 'Due:'}
                  </span>
                  <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="text-xs ml-1" style={{ color: GRAY_DISABLED }}>
                      {new Date(task.dueDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </span>
                </div>
              )}
              {!task.startDate && !task.dueDate && (
                <div className="text-xs text-center py-2" style={{ color: GRAY_DISABLED }}>No dates set</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskDetails
