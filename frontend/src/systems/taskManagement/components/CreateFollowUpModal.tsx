import React, { useState, useRef, useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import { useAuth } from '../../../core/contexts/AuthContext'
import { employeeService, type Employee } from '../../../core/services/employeeService'
import {
  createEventAction,
  type EventAction
} from '../../../core/services/eventActionService'

const PRIMARY = '#056daa'
const DANGER = '#E74C3C'
const BORDER = '#E0E0E0'
const NEUTRAL_DARK = '#333333'
const GRAY_DISABLED = '#9E9E9E'
const NEUTRAL_LIGHT = '#F7F9FB'
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

interface CreateFollowUpModalProps {
  onClose: () => void
  onSuccess: () => void
  FollowUpStatus: string
}

const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({ onClose, onSuccess, FollowUpStatus }) => {
  const { showSuccess, showError } = useToast()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [showPicker, setShowPicker] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    title: '',
    actionDescription: '',
    assignedPerson: { name: '', email: '', role: '', institution: 'City of Kigali' },
    createdBy: {
      name: user?.fullName || '',
      email: user?.email || '',
      role: user?.role || '',
      institution: 'City of Kigali',
    },
    dueDate: '',
    currentStatus: { status: FollowUpStatus as any, description: '' }
  })

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

  const setField = (path: string, value: any) => {
    setForm(prev => {
      const clone: any = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let cur: any = clone
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]
      cur[keys[keys.length - 1]] = value
      return clone
    })
  }

  const pickEmployee = (emp: Employee) => {
    setField('assignedPerson.name', emp.full_name || '')
    setField('assignedPerson.email', emp.email || '')
    setField('assignedPerson.role', emp.title || '')
    setField('assignedPerson.institution', 'City of Kigali')
    setShowPicker(false)
    setEmployeeSearch('')
    setEmployees([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!form.assignedPerson.email.trim()) {
      setFormError('Assigned person email is required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        createdBy: {
          name: user?.fullName || '',
          email: user?.email || '',
          role: user?.role || '',
          institution: 'City of Kigali',
        },
      }
      const res: any = await createEventAction(payload as Partial<EventAction>)
      showSuccess(res?.message || 'Follow-up created successfully')
      onSuccess()
    } catch (error: any) {
      const message = error?.message || 'Failed to create follow-up'
      setFormError(message)
      showError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 px-2 sm:px-4 pb-6 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: '96px' }}>
      <div className="bg-white w-full max-w-lg max-h-[82vh] overflow-y-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sticky top-0 z-10 text-white" style={{ backgroundColor: PRIMARY }}>
          <h3 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading }}>
            New Action (FollowUps)
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cok-btn-outlined-reverse disabled:opacity-50"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
          <p className="text-center text-xs" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>
            Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
          {formError && (
            <p className="p-3 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>{formError}</p>
          )}

          <div>
            <label style={labelStyle}>Title <span style={{ color: DANGER }}>*</span></label>
            <input
              type="text" required maxLength={200}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Follow-up title"
              className={inputClassName} style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
            <textarea
              required maxLength={2000} rows={3}
              value={form.actionDescription}
              onChange={(e) => setField('actionDescription', e.target.value)}
              placeholder="Describe the follow-up"
              className={inputClassName}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          <div style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                Assigned Person <span style={{ color: DANGER }}>*</span>
              </p>
            </div>
            <div className="p-3 sm:p-4 space-y-4">
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
                  <label style={labelStyle}>Full Name <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="text" required maxLength={200}
                    value={form.assignedPerson.name}
                    onChange={(e) => setField('assignedPerson.name', e.target.value)}
                    placeholder="Full name"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email Address <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="email" required maxLength={300}
                    value={form.assignedPerson.email}
                    onChange={(e) => setField('assignedPerson.email', e.target.value)}
                    placeholder="Email address"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Role / Position <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="text" required maxLength={200}
                    value={form.assignedPerson.role}
                    onChange={(e) => setField('assignedPerson.role', e.target.value)}
                    placeholder="Role / Position"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Due Date <span style={{ color: DANGER }}>*</span></label>
            <input
              type="date" required
              value={form.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
              className={inputClassName} style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Status <span style={{ color: DANGER }}>*</span></label>
            <select
              value={form.currentStatus.status}
              onChange={(e) => setField('currentStatus.status', e.target.value)}
              className={`${inputClassName} cursor-pointer`}
              style={inputStyle}
            >
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Status Note <span style={{ color: DANGER }}>*</span></label>
            <textarea
              required maxLength={1000} rows={2}
              value={form.currentStatus.description}
              onChange={(e) => setField('currentStatus.description', e.target.value)}
              placeholder="Status note"
              className={inputClassName}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="cok-btn-outlined disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '0.6rem 1.2rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cok-btn-primary sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ width: '100%', padding: '0.6rem 1.4rem' }}
            >
              {submitting ? 'Creating...' : 'Create Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateFollowUpModal
