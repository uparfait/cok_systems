// TaskDetails - Component for task details editing with comprehensive date management
// UPDATED: Allow date editing at all task statuses

import React from 'react'
import { FiCalendar, FiEdit, FiCheck, FiX } from 'react-icons/fi'

interface TaskDetailsProps {
  task: any
  editingSections: {
    title: boolean
    description: boolean
    dates: boolean
  }
  editForms: {
    title: string
    description: string
    startDate: string
    startTime: string
    dueDate: string
    dueTime: string
  }
  loadingStates: {
    title: boolean
    description: boolean
    dates: boolean
  }
  onEditSection: (section: string, value: boolean) => void
  onEditFormChange: (field: string, value: string) => void
  onSaveDescription: () => void
  onSaveDates: () => void
}

const TaskDetails: React.FC<TaskDetailsProps> = ({
  task,
  editingSections,
  editForms,
  loadingStates,
  onEditSection,
  onEditFormChange,
  onSaveDescription,
  onSaveDates
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
     
      <div className="space-y-4">
        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            {!editingSections.description && (
              <button
                onClick={() => onEditSection('description', true)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loadingStates.description}
                placeholder="Enter task description"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={onSaveDescription}
                  disabled={loadingStates.description}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loadingStates.description ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    onEditFormChange('description', task.description || '')
                    onEditSection('description', false)
                  }}
                  disabled={loadingStates.description}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-700 break-words max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3">
              {task.description || 'No description'}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <span className={'px-2 py-1 rounded-full text-sm font-medium ' + (task.status === 'Completed' ? 'bg-green-100 text-green-800' : task.status === 'In-progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800')}>
            {task.status.replace('-', ' ')}
          </span>
        </div>

        {/* Dates - NOW EDITABLE AT ALL STATUSES */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Timeline</label>
            {!editingSections.dates && (
              <button
                onClick={() => onEditSection('dates', true)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                title="Edit dates"
              >
                <FiEdit className="w-3 h-3" />
              </button>
            )}
          </div>

          {editingSections.dates ? (
            <div className="space-y-3 bg-blue-50 rounded-lg p-4 border border-blue-100">
              {/* Start Date - Always editable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Start Date & Time</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      value={editForms.startDate}
                      onChange={(e) => onEditFormChange('startDate', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loadingStates.dates}
                    />
                  </div>
                  <input
                    type="time"
                    value={editForms.startTime}
                    onChange={(e) => onEditFormChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingStates.dates}
                  />
                </div>
                {editForms.startDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(editForms.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Due Date - Always editable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {task.status === 'Completed' ? 'Completed Date & Time' : 'Due Date & Time'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      value={editForms.dueDate}
                      onChange={(e) => onEditFormChange('dueDate', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loadingStates.dates}
                    />
                  </div>
                  <input
                    type="time"
                    value={editForms.dueTime}
                    onChange={(e) => onEditFormChange('dueTime', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingStates.dates}
                  />
                </div>
                {editForms.dueDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(editForms.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Validation message */}
              {editForms.startDate && editForms.dueDate && (
                new Date(`${editForms.startDate}T${editForms.startTime}`).getTime() > new Date(`${editForms.dueDate}T${editForms.dueTime}`).getTime() && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    ⚠️ Start date cannot be after due date
                  </div>
                )
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onSaveDates}
                  disabled={loadingStates.dates || (editForms.startDate && editForms.dueDate && new Date(`${editForms.startDate}T${editForms.startTime}`).getTime() > new Date(`${editForms.dueDate}T${editForms.dueTime}`).getTime()) || false}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  {loadingStates.dates ? 'Saving...' : 'Save Dates'}
                </button>
                <button
                  onClick={() => {
                    onEditFormChange('startDate', task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '')
                    onEditFormChange('startTime', task.startDate ? new Date(task.startDate).toTimeString().slice(0, 5) : '12:00')
                    onEditFormChange('dueDate', task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
                    onEditFormChange('dueTime', task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '12:00')
                    onEditSection('dates', false)
                  }}
                  disabled={loadingStates.dates}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              {task.startDate && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">Start:</span>
                  <span className="text-gray-900 font-semibold">
                    {new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                    <span className="text-xs text-gray-600 ml-1">
                      {new Date(task.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </span>
                </div>
              )}
              {task.dueDate && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">
                    {task.status === 'Completed' ? 'Completed:' : 'Due:'}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                    <span className="text-xs text-gray-600 ml-1">
                      {new Date(task.dueDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </span>
                </div>
              )}
              {!task.startDate && !task.dueDate && (
                <div className="text-gray-500 text-sm text-center py-2">No dates set</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskDetails

