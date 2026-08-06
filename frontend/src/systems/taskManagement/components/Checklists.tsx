// Checklists - Component for checklists management with CoK design

import React, { useState } from 'react'
import { FiEdit, FiTrash2, FiPlus, FiX, FiCheck } from 'react-icons/fi'

const PRIMARY = '#056daa'
const NEUTRAL_DARK = '#333333'
const NEUTRAL_LIGHT = '#F7F9FB'
const WHITE = '#FFFFFF'
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
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm" style={labelStyle}>
          Checklists ({checklists?.length || 0})
        </label>
        <button
          type="button"
          onClick={onShowAddChecklistForm}
          disabled={loading}
          className="flex items-center gap-1 text-sm font-medium cursor-pointer"
          style={{ color: PRIMARY, fontFamily: fontHeading }}
        >
          <FiPlus className="w-4 h-4" />
          Add Checklist
        </button>
      </div>

      <div className="space-y-3">
        {checklists?.map((checklist: Checklist) => (
          <div key={checklist._id} className="border p-4" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
            <div className="flex items-center justify-between mb-3">
              {editingChecklist === checklist._id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={checklistTitle}
                    onChange={(e) => onChecklistTitleChange(e.target.value)}
                    className="flex-1 cok-auth-input"
                    style={{ fontSize: '13px' }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={onSaveChecklistTitle}
                    disabled={loading}
                    className="cok-btn-primary"
                    style={{ width: 'auto', padding: '0.4rem 0.8rem' }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditChecklist}
                    disabled={loading}
                    className="cok-btn-outlined"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <h4 className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {checklist.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditChecklistTitle(checklist._id!, checklist.title)}
                      disabled={loading}
                      className="p-1 cursor-pointer"
                      style={{ color: PRIMARY }}
                      title="Edit checklist"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteChecklist(checklist._id!)}
                      disabled={loading}
                      className="p-1 cursor-pointer"
                      style={{ color: DANGER }}
                      title="Delete checklist"
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
                  <div key={index} className="flex items-center gap-3 p-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => onUpdateChecklistItem(checklist._id!, index, e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4"
                      style={{ accentColor: PRIMARY }}
                    />
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingItemText}
                          onChange={(e) => setEditingItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditingItem()
                            if (e.key === 'Escape') cancelEditingItem()
                          }}
                          className="flex-1 cok-auth-input"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveEditingItem}
                          disabled={!editingItemText.trim()}
                          className="p-1 cursor-pointer"
                          style={{ color: SUCCESS }}
                        >
                          <FiCheck className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={cancelEditingItem} className="p-1 cursor-pointer" style={{ color: GRAY_DISABLED }}>
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`flex-1 text-sm ${item.completed ? 'line-through' : ''}`}
                          style={{ color: item.completed ? GRAY_DISABLED : NEUTRAL_DARK }}
                        >
                          {item.text}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditingItem(checklist._id!, index, item.text)}
                            disabled={loading}
                            className="p-1 cursor-pointer"
                            style={{ color: GRAY_DISABLED }}
                            title="Edit item"
                          >
                            <FiEdit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onConfirmDeleteItem(checklist._id!, index, item.text)}
                            disabled={loading}
                            className="p-1 cursor-pointer"
                            style={{ color: DANGER }}
                            title="Delete item"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {(!checklists || checklists.length === 0) && (
          <div className="text-center py-6" style={{ color: GRAY_DISABLED }}>
            <FiTrash2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No checklists yet</p>
          </div>
        )}
      </div>

      {/* Add Checklist Form */}
      {showAddChecklistForm && (
        <div className="border p-4 mt-4" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>
                Checklist Title
              </label>
              <input
                type="text"
                placeholder="Enter checklist title"
                value={addChecklistForm.title}
                onChange={(e) => onAddChecklistFormChange('title', e.target.value)}
                className="cok-auth-input"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs mb-2" style={labelStyle}>
                Items
              </label>
              <div className="space-y-2">
                {addChecklistForm.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 border p-3" style={{ borderColor: BORDER, backgroundColor: WHITE, borderRadius: 0 }}>
                    <input
                      type="text"
                      placeholder="Enter item text"
                      value={item}
                      onChange={(e) => onUpdateAddChecklistItem(index, e.target.value)}
                      className="flex-1 cok-auth-input"
                      disabled={loading}
                    />
                    {addChecklistForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveAddChecklistItem(index)}
                        disabled={loading}
                        className="p-1 cursor-pointer"
                        style={{ color: DANGER }}
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={onAddChecklistItem}
                disabled={loading}
                className="mt-2 flex items-center gap-1 text-sm font-medium cursor-pointer"
                style={{ color: PRIMARY, fontFamily: fontHeading }}
              >
                <FiPlus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <button
                type="button"
                onClick={onAddNewChecklist}
                disabled={loading}
                className="cok-btn-primary"
                style={{ width: 'auto', padding: '0.6rem 1rem' }}
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
                Add Checklist
              </button>
              <button
                type="button"
                onClick={onCancelAddChecklist}
                disabled={loading}
                className="cok-btn-outlined"
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
