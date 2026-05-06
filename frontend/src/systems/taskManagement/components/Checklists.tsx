// Checklists - Component for checklists management

import React from 'react'
import { FiEdit, FiTrash2, FiPlus, FiX } from 'react-icons/fi'

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

interface ChecklistsProps {
  checklists: Checklist[]
  editingChecklist: string | null
  checklistTitle: string
  showAddChecklistForm: boolean
  addChecklistForm: { title: string; items: string[] }
  loading: boolean
  taskStatus: string
  onEditChecklistTitle: (id: string, title: string) => void
  onSaveChecklistTitle: () => void
  onCancelEditChecklist: () => void
  onDeleteChecklist: (id: string) => void
  onUpdateChecklistItem: (checklistId: string, index: number, completed: boolean) => void
  onShowAddChecklistForm: () => void
  onAddChecklistItem: () => void
  onUpdateAddChecklistItem: (index: number, text: string) => void
  onRemoveAddChecklistItem: (index: number) => void
  onAddNewChecklist: () => void
  onCancelAddChecklist: () => void
  onChecklistTitleChange: (value: string) => void
  onAddChecklistFormChange: (field: string, value: string) => void
}

const Checklists: React.FC<ChecklistsProps> = ({
  checklists,
  editingChecklist,
  checklistTitle,
  showAddChecklistForm,
  addChecklistForm,
  loading,
  taskStatus,
  onEditChecklistTitle,
  onSaveChecklistTitle,
  onCancelEditChecklist,
  onDeleteChecklist,
  onUpdateChecklistItem,
  onShowAddChecklistForm,
  onAddChecklistItem,
  onUpdateAddChecklistItem,
  onRemoveAddChecklistItem,
  onAddNewChecklist,
  onCancelAddChecklist,
  onChecklistTitleChange,
  onAddChecklistFormChange
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Checklists ({checklists?.length || 0})</h3>
        {taskStatus !== 'Completed' && (
          <button onClick={onShowAddChecklistForm} disabled={loading} className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700">
            <span>+</span>
            <span>Add Checklist</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {checklists?.map((checklist: Checklist) => (
          <div key={checklist._id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              {editingChecklist === checklist._id ? (
                <div className="flex items-center space-x-2 flex-1">
                  <input
                    type="text"
                    value={checklistTitle}
                    onChange={(e) => onChecklistTitleChange(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <button
                    onClick={onSaveChecklistTitle}
                    disabled={loading}
                    className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEditChecklist}
                    disabled={loading}
                    className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-900">{checklist.title}</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onEditChecklistTitle(checklist._id!, checklist.title)}
                      disabled={loading}
                      className="text-gray-400 hover:text-blue-600 disabled:opacity-50"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteChecklist(checklist._id!)}
                      disabled={loading}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {checklist.items?.map((item: ChecklistItem, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => onUpdateChecklistItem(checklist._id!, index, e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={item.completed ? 'line-through text-gray-500' : 'text-gray-900'}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {(!checklists || checklists.length === 0) && (
          <div className="text-center py-6 text-gray-500">
            <FiTrash2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No checklists yet</p>
          </div>
        )}
      </div>

      {/* Add Checklist Form */}
      {showAddChecklistForm && taskStatus !== 'Completed' && (
        <div className="bg-gray-50 rounded-lg p-4 mt-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Checklist title"
              value={addChecklistForm.title}
              onChange={(e) => onAddChecklistFormChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            {addChecklistForm.items.map((item, index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Item text"
                  value={item}
                  onChange={(e) => onUpdateAddChecklistItem(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                {addChecklistForm.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveAddChecklistItem(index)}
                    disabled={loading}
                    className="px-2 py-2 text-red-500 hover:text-red-700"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={onAddChecklistItem}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Item
            </button>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={onAddNewChecklist}
                disabled={loading}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                Add Checklist
              </button>
              <button
                type="button"
                onClick={onCancelAddChecklist}
                disabled={loading}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Checklists