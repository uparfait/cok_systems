// TaskDetails - Component for task details editing

import React from 'react'
import { FiCalendar } from 'react-icons/fi'

interface TaskDetailsProps {
  task: any
  isEditing: boolean
  editForm: any
  onEditFormChange: (field: string, value: string) => void
  loading: boolean
}

const TaskDetails: React.FC<TaskDetailsProps> = ({
  task,
  isEditing,
  editForm,
  onEditFormChange,
  loading
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
     
      <div className="space-y-4">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          {isEditing ? (
            <textarea
              value={editForm.description}
              onChange={(e) => onEditFormChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          ) : (
             <div className="text-gray-700 break-words max-h-32 overflow-y-auto">
               {task.description || 'No description'}
             </div>
          )}
        </div>

        {/* Status */}
        <div>
          {isEditing ? (
            <select
              value={editForm.status}
              onChange={(e) => onEditFormChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="Under-review">Under Review</option>
              <option value="In-progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          ) : (
            <span className={'px-2 py-1 rounded-full text-sm font-medium ' + (task.status === 'Completed' ? 'bg-green-100 text-green-800' : task.status === 'In-progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800')}>
              {task.status.replace('-', ' ')}
            </span>
          )}
        </div>

        {/* Date Fields Based on Status */}
        {isEditing && editForm.status === 'Under-review' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start & End Dates</label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: "translateY(-50%)" }} />
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => onEditFormChange('startDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => onEditFormChange('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: "translateY(-50%)" }} />
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => onEditFormChange('dueDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <input
                  type="time"
                  value={editForm.dueTime}
                  onChange={(e) => onEditFormChange('dueTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {isEditing && editForm.status === 'In-progress' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: "translateY(-50%)" }} />
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => onEditFormChange('dueDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <input
                type="time"
                value={editForm.dueTime}
                onChange={(e) => onEditFormChange('dueTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {isEditing && editForm.status === 'Completed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start & End Dates</label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: "translateY(-50%)" }} />
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => onEditFormChange('startDate', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => onEditFormChange('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: "translateY(-50%)" }} />
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => onEditFormChange('dueDate', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <input
                  type="time"
                  value={editForm.dueTime}
                  onChange={(e) => onEditFormChange('dueTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskDetails