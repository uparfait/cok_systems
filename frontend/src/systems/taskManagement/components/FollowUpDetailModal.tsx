import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiTrash2, FiX } from 'react-icons/fi'
import AttachmentViewer from './AttachmentViewer'
import ConfirmDialog from '../../event-managment/components/sub-components/ConfirmDialog'
import { useAuth } from '../../../core/contexts/AuthContext'
import { useToast } from '../../../core/contexts/ToastContext'
import { employeeService, type Employee } from '../../../core/services/employeeService'
import {
  updateEventAction,
  updateEventActionStatusWithDocument,
  deleteEventAction,
  type EventAction
} from '../../../core/services/eventActionService'

const PRIMARY = '#056daa'
const WHITE = '#FFFFFF'
const BORDER = '#E0E0E0'
const NEUTRAL_DARK = '#333333'
const GRAY_DISABLED = '#9E9E9E'
const NEUTRAL_LIGHT = '#F7F9FB'
const DANGER = '#E74C3C'
const fontHeading = "'Montserrat', sans-serif"

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm'
const inputStyle: React.CSSProperties = { paddingLeft: '12px' }

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
  display: 'block',
  marginBottom: '6px',
}

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'] as const

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending': return '#F39C12'
    case 'In Progress': return PRIMARY
    case 'Completed': return '#4CAF50'
    case 'Cancelled': return DANGER
    default: return GRAY_DISABLED
  }
}

const docUrl = (url?: string) => {
  if (!url) return ''
  return url.startsWith('/uploads') ? `/cok/api/v1${url}` : url
}

const fmtFull = (d?: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface FollowUpDetailModalProps {
  followup: EventAction
  onClose: () => void
  onUpdate: (updatedFollowUp?: EventAction) => void
  onDelete?: () => void
  allowFullEdit?: boolean
}

const FollowUpDetailModal: React.FC<FollowUpDetailModalProps> = ({ followup: initialFollowUp, onClose, onUpdate, onDelete, allowFullEdit = false }) => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const [followup, setFollowUp] = useState<EventAction>(initialFollowUp)
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')

  const isMinutesTask = !!followup.eventSpecialId
    && followup.eventSpecialId !== 'FOLLOWUP'
    && /minutes/i.test(followup.title || '')

  const [editingAll, setEditingAll] = useState(false)
  const [editForm, setEditForm] = useState({
    title: initialFollowUp.title || '',
    actionDescription: initialFollowUp.actionDescription || '',
    dueDate: initialFollowUp.dueDate ? initialFollowUp.dueDate.slice(0, 10) : '',
    assignedPerson: {
      name: initialFollowUp.assignedPerson?.name || '',
      email: initialFollowUp.assignedPerson?.email || '',
      role: initialFollowUp.assignedPerson?.role || '',
      institution: initialFollowUp.assignedPerson?.institution || '',
    },
    createdBy: {
      name: initialFollowUp.createdBy?.name || '',
      email: initialFollowUp.createdBy?.email || '',
      role: initialFollowUp.createdBy?.role || '',
      institution: initialFollowUp.createdBy?.institution || '',
    },
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const [showPicker, setShowPicker] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState(initialFollowUp.actionDescription || '')
  const [loading, setLoading] = useState(false)
  const [viewingAttachment, setViewingAttachment] = useState<any>(null)

  const currentStatus = followup.currentStatus?.status || 'Pending'
  const [chosenStatus, setChosenStatus] = useState<string>(currentStatus)
  const [statusNote, setStatusNote] = useState('')
  const [statusFiles, setStatusFiles] = useState<File[]>([])
  const [statusError, setStatusError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (!showPicker) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const q = employeeSearch.trim()
    if (!q) { setEmployees([]); return }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res: any = await employeeService.search(q, 1, 20)
        setEmployees(res?.data || [])
      } catch {
        setEmployees([])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [employeeSearch, showPicker])

  const pickEmployee = (emp: Employee) => {
    setEditForm(p => ({
      ...p,
      assignedPerson: {
        name: emp.full_name || '',
        email: emp.email || '',
        role: emp.title || '',
        institution: 'City of Kigali',
      },
    }))
    setShowPicker(false)
    setEmployeeSearch('')
    setEmployees([])
  }

  const handleDescriptionSave = async () => {
    setLoading(true)
    try {
      const res: any = await updateEventAction(followup._id, {
        actionDescription: editDescription.trim()
      })
      setFollowUp(res.data)
      setEditingDescription(false)
      onUpdate(res.data)
      showSuccess('Description updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update description')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusError('')
    if (!statusNote.trim()) { setStatusError('Description is required.'); return }
    if (chosenStatus === currentStatus) { setStatusError('Please choose a different status.'); return }

    setSavingStatus(true)
    try {
      const res: any = await updateEventActionStatusWithDocument(
        followup._id, chosenStatus, statusNote.trim(), statusFiles,
        { name: user?.fullName || '', email: user?.email || '' },
      )
      const updated = res?.data || {
        ...followup,
        currentStatus: { status: chosenStatus as any, description: statusNote.trim() },
      }
      setFollowUp(updated)
      onUpdate(updated)
      setStatusNote('')
      setStatusFiles([])
      showSuccess(`Follow-up moved to ${chosenStatus}`)
    } catch (error: any) {
      const message = error?.message || 'Failed to update status'
      setStatusError(message)
      showError(message)
    } finally {
      setSavingStatus(false)
    }
  }

  const handleFullEditSave = async () => {
    if (!editForm.title.trim() || !editForm.assignedPerson.name.trim() || !editForm.assignedPerson.email.trim()) {
      showError('Title, assigned name and email are required')
      return
    }
    setSavingEdit(true)
    try {
      const res: any = await updateEventAction(followup._id, {
        title: editForm.title.trim(),
        actionDescription: editForm.actionDescription.trim(),
        dueDate: editForm.dueDate,
        assignedPerson: {
          name: editForm.assignedPerson.name.trim(),
          email: editForm.assignedPerson.email.trim(),
          role: editForm.assignedPerson.role.trim(),
          institution: editForm.assignedPerson.institution.trim() || 'City of Kigali',
        },
        createdBy: {
          name: user?.fullName || followup.createdBy?.name || '',
          email: user?.email || followup.createdBy?.email || '',
          role: user?.role || followup.createdBy?.role || '',
          institution: 'City of Kigali',
        },
      } as any)
      setFollowUp(res.data)
      setEditingAll(false)
      onUpdate(res.data)
      showSuccess('Follow-up updated')
    } catch (error: any) {
      showError(error?.message || 'Failed to update follow-up')
    } finally {
      setSavingEdit(false)
    }
  }

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleDelete = async () => {
    setConfirmDeleteOpen(false)
    setLoading(true)
    try {
      await deleteEventAction(followup._id)
      showSuccess('Follow-up deleted')
      if (onDelete) onDelete()
      onClose()
    } catch (error: any) {
      showError(error?.message || 'Failed to delete follow-up')
    } finally {
      setLoading(false)
    }
  }

  const history = [...(followup.statusHistory || [])].reverse()

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 px-3 md:px-4 pb-6 overflow-y-auto" style={{ paddingTop: '96px' }}>
      <div className="w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate" style={{ fontFamily: fontHeading }}>
              {followup.title}
            </h2>
            <p className="text-white/80 text-xs mt-0.5">Follow-up</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={loading}
              title="Delete follow-up"
              className="cok-btn-outlined-reverse disabled:opacity-50"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiTrash2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {([['details', 'Details'], ['history', `History (${followup.statusHistory?.length || 0})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className="px-5 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
              style={{
                fontFamily: fontHeading,
                color: activeTab === key ? PRIMARY : GRAY_DISABLED,
                borderBottom: `2px solid ${activeTab === key ? PRIMARY : 'transparent'}`,
                backgroundColor: 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'details' ? (
            <div className="space-y-5">
              {isMinutesTask && (
                <button
                  type="button"
                  onClick={() => navigate(`/event/${followup.eventSpecialId}/editor`)}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: DANGER, fontFamily: fontHeading, border: 0, borderRadius: 0 }}
                >
                  Edit Minutes
                </button>
              )}

              {allowFullEdit && !isMinutesTask && !editingAll && (
                <button
                  type="button"
                  onClick={() => setEditingAll(true)}
                  className="cok-btn-outlined"
                  style={{ padding: '0.45rem 1rem' }}
                >
                  Edit Details
                </button>
              )}

              {allowFullEdit && !isMinutesTask && editingAll && (
                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Edit Details</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label style={labelStyle}>Title <span style={{ color: DANGER }}>*</span></label>
                      <input
                        type="text" maxLength={200}
                        value={editForm.title}
                        onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))}
                        className={inputClassName} style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
                      <textarea
                        rows={3} maxLength={2000}
                        value={editForm.actionDescription}
                        onChange={(e) => setEditForm(p => ({ ...p, actionDescription: e.target.value }))}
                        className={inputClassName}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPicker(p => !p)}
                      className="cok-btn-outlined"
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      {showPicker ? 'Hide employee search' : 'Pick from employees'}
                    </button>
                    {showPicker && (
                      <div style={{ border: `1px solid ${BORDER}` }}>
                        <div className="p-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <input
                            type="text"
                            placeholder="Search employee by email or phone"
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            autoFocus
                            className="w-full cok-auth-input pr-3 py-1.5 text-xs"
                            style={{ paddingLeft: '12px' }}
                          />
                        </div>
                        <ul className="max-h-44 overflow-y-auto bg-white">
                          {searching ? (
                            <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>Searching...</li>
                          ) : employees.length === 0 ? (
                            <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>
                              {employeeSearch.trim() ? 'No employees found' : 'Type an email or phone number to search'}
                            </li>
                          ) : employees.map((emp) => (
                            <li key={emp._id || emp.email}>
                              <button
                                type="button"
                                onClick={() => pickEmployee(emp)}
                                className="w-full text-left px-3 sm:px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                                style={{ borderBottom: `1px solid ${BORDER}` }}
                              >
                                <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{emp.full_name}</p>
                                <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                                  {[emp.title, emp.telephone].filter(Boolean).join(', ')}
                                </p>
                                <p className="text-xs mt-0.5 break-all" style={{ color: PRIMARY }}>{emp.email}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle}>Assigned Name <span style={{ color: DANGER }}>*</span></label>
                        <input
                          type="text" maxLength={200}
                          value={editForm.assignedPerson.name}
                          onChange={(e) => setEditForm(p => ({ ...p, assignedPerson: { ...p.assignedPerson, name: e.target.value } }))}
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Assigned Email <span style={{ color: DANGER }}>*</span></label>
                        <input
                          type="email" maxLength={300}
                          value={editForm.assignedPerson.email}
                          onChange={(e) => setEditForm(p => ({ ...p, assignedPerson: { ...p.assignedPerson, email: e.target.value } }))}
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Role / Position</label>
                        <input
                          type="text" maxLength={200}
                          value={editForm.assignedPerson.role}
                          onChange={(e) => setEditForm(p => ({ ...p, assignedPerson: { ...p.assignedPerson, role: e.target.value } }))}
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Due Date <span style={{ color: DANGER }}>*</span></label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                        className={inputClassName} style={inputStyle}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleFullEditSave}
                        disabled={savingEdit}
                        className="cok-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ width: 'auto', padding: '0.5rem 1.2rem' }}
                      >
                        {savingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAll(false)}
                        disabled={savingEdit}
                        className="cok-btn-outlined disabled:opacity-50"
                        style={{ padding: '0.5rem 1.2rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 style={labelStyle} className="mb-2">Description</h4>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className={inputClassName}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                      rows={3}
                      disabled={loading}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleDescriptionSave} disabled={loading} className="cok-btn-primary" style={{ width: 'auto', padding: '0.45rem 1rem' }}>
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingDescription(false)} disabled={loading} className="cok-btn-outlined" style={{ padding: '0.45rem 1rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm break-words" style={{ color: '#555555', fontFamily: fontHeading }}>
                      {followup.actionDescription || 'No description provided.'}
                    </p>
                    {!isMinutesTask && (
                      <button onClick={() => setEditingDescription(true)} className="mt-2 text-xs cursor-pointer" style={{ color: PRIMARY, fontFamily: fontHeading, background: 'transparent', border: 0 }}>
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Assigned To</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold break-words" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{followup.assignedPerson?.name || '-'}</p>
                    {followup.assignedPerson?.email && (
                      <a href={`mailto:${followup.assignedPerson.email}`} className="text-xs underline break-all block mt-1" style={{ color: PRIMARY }}>
                        {followup.assignedPerson.email}
                      </a>
                    )}
                    {followup.assignedPerson?.role && (
                      <p className="text-xs mt-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                        {followup.assignedPerson.role}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Due Date</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      {followup.dueDate ? fmtFull(followup.dueDate) : 'No due date set'}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStatusSubmit} style={{ border: `1px solid ${BORDER}` }}>
                <div className="px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Update Status</p>
                </div>
                <div className="p-4 space-y-4">
                  {statusError && (
                    <p className="p-3 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>{statusError}</p>
                  )}

                  <div>
                    <label style={labelStyle}>
                      Status <span style={{ color: DANGER }}>*</span>
                    </label>
                    <select
                      value={chosenStatus}
                      onChange={(e) => setChosenStatus(e.target.value)}
                      disabled={savingStatus}
                      className={`${inputClassName} cursor-pointer`}
                      style={inputStyle}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}{status === currentStatus ? ' (Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Description <span style={{ color: DANGER }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Describe what was done or reason for this change"
                      className={inputClassName}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Attach Documents <span className="normal-case font-normal" style={{ color: GRAY_DISABLED }}>(optional)</span>
                    </label>

                    {statusFiles.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {statusFiles.map((f, idx) => (
                          <div key={`${f.name}-${idx}`} className="flex items-center gap-3 px-3 py-2.5" style={{ border: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                            <span className="text-sm flex-1 truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setViewingAttachment({
                                filename: f.name,
                                originalName: f.name,
                                url: URL.createObjectURL(f),
                                _objectUrl: true,
                              })}
                              className="text-xs font-semibold uppercase cursor-pointer shrink-0"
                              style={{ color: PRIMARY, fontFamily: fontHeading, background: 'transparent', border: 0 }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              title="Remove file"
                              onClick={() => setStatusFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 cursor-pointer shrink-0 hover:bg-[#FDECEA]"
                              style={{ color: DANGER, background: 'transparent', border: 0 }}
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label
                      className="cursor-pointer flex items-center gap-3 px-3 py-3 transition-colors"
                      style={{ border: '2px dashed #9CC7E4', backgroundColor: NEUTRAL_LIGHT }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                          {statusFiles.length > 0 ? 'Click to add more files' : 'Click to upload files'}
                        </p>
                        <p className="text-xs" style={{ color: GRAY_DISABLED }}>PDF, Word, Excel, Images (up to 10)</p>
                      </div>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || [])
                          if (picked.length > 0) {
                            setStatusFiles(prev => [...prev, ...picked].slice(0, 10))
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={savingStatus}
                    className="cok-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ padding: '0.6rem 1.2rem' }}
                  >
                    {savingStatus ? 'Saving...' : `Set to ${chosenStatus}`}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {history.length > 0 ? (
                history.map((entry, index) => (
                  <div key={index} style={{ border: `1px solid ${BORDER}` }}>
                    <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: getStatusColor(entry.status), fontFamily: fontHeading }}>
                        {entry.status}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{fmtFull(entry.changedAt)}</span>
                        {entry.changedBy?.name && (
                          <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                            by <span style={{ color: NEUTRAL_DARK }}>{entry.changedBy.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm break-words" style={{ color: '#555555', fontFamily: fontHeading }}>{entry.description}</p>
                      {(() => {
                        const docs = (entry.documents && entry.documents.length > 0)
                          ? entry.documents
                          : (entry.document?.url ? [entry.document] : [])
                        if (docs.length === 0) return null
                        return (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {docs.map((doc, di) => (
                              <button
                                key={di}
                                type="button"
                                onClick={() => setViewingAttachment({
                                  filename: doc.originalName || doc.filename,
                                  originalName: doc.originalName || doc.filename,
                                  url: docUrl(doc.url),
                                })}
                                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer transition-colors hover:bg-[#E3F2FD]"
                                style={{ color: PRIMARY, backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}`, fontFamily: fontHeading }}
                              >
                                <span className="truncate max-w-[180px]">{doc.originalName || 'Attached document'}</span>
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-10" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  No history recorded yet.
                </p>
              )}
            </div>
          )}
        </div>

        {viewingAttachment && (
          <AttachmentViewer
            attachment={viewingAttachment}
            onClose={() => {
              if (viewingAttachment._objectUrl) URL.revokeObjectURL(viewingAttachment.url)
              setViewingAttachment(null)
            }}
          />
        )}

        <ConfirmDialog
          open={confirmDeleteOpen}
          title="Delete Follow-up"
          message={`You are about to delete "${followup.title}". This cannot be undone.`}
          busy={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      </div>
    </div>
  )
}

export default FollowUpDetailModal
