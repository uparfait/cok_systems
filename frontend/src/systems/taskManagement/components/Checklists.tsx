// Checklists - Component for checklists management

import React, { useState } from 'react'
import { FiEdit, FiTrash2, FiPlus, FiX, FiCheck, FiX as FiXIcon } from 'react-icons/fi'

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
  onUpdateChecklistItemText: (checklistId: string, itemIndex: number, text: string) => void
  onDeleteChecklistItem: (checklistId: string, itemIndex: number) => void
  onConfirmDeleteItem: (checklistId: string, itemIndex: number, itemText: string) => void
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
  onUpdateChecklistItemText,
  onDeleteChecklistItem,
  onConfirmDeleteItem,
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
  const [editingItem, setEditingItem] = useState<{ checklistId: string; itemIndex: number } | null>(null)
  const [editingItemText, setEditingItemText] = useState('')

  const startEditingItem = (checklistId: string, itemIndex: number, currentText: string) => {
    setEditingItem({ checklistId, itemIndex })
    setEditingItemText(currentText)
  }

  const cancelEditingItem = () => {
    setEditingItem(null)
    setEditingItemText('')
  }

  const saveEditingItem = () => {
    if (editingItem && editingItemText.trim()) {
      onUpdateChecklistItemText(editingItem.checklistId, editingItem.itemIndex, editingItemText.trim())
      cancelEditingItem()
    }
  }

  return (
<div>
  {/* Added pt-6 for padding before the checklist section starts */}
  <div className="pt-6">
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
              /* Flex container to keep Title and Actions on the same line */
              <div className="flex items-center justify-between w-full">
                {/* Applied text-lg for size and font-bold for weight */}
                <h2 className="text-lg font-bold text-gray-900 truncate mr-4">
                  {checklist.title}
                </h2>
                <div className="flex items-center space-x-2 shrink-0">
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
            {checklist.items?.map((item: ChecklistItem, index: number) => {
              const isEditing = editingItem?.checklistId === checklist._id && editingItem?.itemIndex === index
              return (
                <div key={index} className="flex items-center space-x-3 group">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => onUpdateChecklistItem(checklist._id!, index, e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  {isEditing ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <input
                        type="text"
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingItem()
                          if (e.key === 'Escape') cancelEditingItem()
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={saveEditingItem}
                        disabled={!editingItemText.trim()}
                        className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                      >
                        <FiCheck className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEditingItem} className="p-1 text-gray-600 hover:text-gray-700">
                        <FiXIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Added break-words to ensure checklist items also wrap correctly */}
                      <span
                        className={`flex-1 cursor-pointer break-words text-sm ${
                          item.completed ? 'line-through text-gray-500' : 'text-gray-900'
                        } hover:bg-gray-50 px-1 py-0.5 rounded`}
                        onClick={() => taskStatus !== 'Completed' && startEditingItem(checklist._id!, index, item.text)}
                        title={taskStatus !== 'Completed' ? 'Click to edit' : ''}
                      >
                        {item.text}
                      </span>
                      {taskStatus !== 'Completed' && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                          <button
                            onClick={() => startEditingItem(checklist._id!, index, item.text)}
                            disabled={loading}
                            className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                            title="Edit item"
                          >
                            <FiEdit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onConfirmDeleteItem(checklist._id!, index, item.text)}
                            disabled={loading}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete item"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
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
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
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
</div>

  )
}

export default Checklists