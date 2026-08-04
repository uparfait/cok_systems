import React, { useState } from 'react'
import { FiX } from 'react-icons/fi'
import { useToast } from '../../../core/contexts/ToastContext'
import {
  createEventAction,
  type EventAction
} from '../../../core/services/eventActionService'

interface CreateFollowUpModalProps {
  onClose: () => void
  onSuccess: () => void
  FollowUpStatus: string
}

const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({ onClose, onSuccess, FollowUpStatus }) => {
  const { showSuccess, showError } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    actionDescription: '',
    assignedPerson: { name: '', role: '', institution: '' },
    dueDate: '',
    currentStatus: { status: FollowUpStatus as any, description: '' }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createEventAction(form as Partial<EventAction>)
      showSuccess('Follow-up created successfully')
      onSuccess()
    } catch (error: any) {
      showError(error?.message || 'Failed to create follow-up')
    } finally {
      setSubmitting(false)
    }
  }

  const setField = (path: string, value: any) => {
    setForm(prev => {
      const clone = { ...prev }
      const keys = path.split('.')
      let cur: any = clone
      for (let i = 0; i < keys.length - 1; i++) {
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
      return clone
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            New Follow-up
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
              Description
            </label>
            <textarea
              value={form.actionDescription}
              onChange={(e) => setField('actionDescription', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
                Assigned Person Name
              </label>
              <input
                type="text"
                value={form.assignedPerson.name}
                onChange={(e) => setField('assignedPerson.name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
                Role
              </label>
              <input
                type="text"
                value={form.assignedPerson.role}
                onChange={(e) => setField('assignedPerson.role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
              Institution
            </label>
            <input
              type="text"
              value={form.assignedPerson.institution}
              onChange={(e) => setField('assignedPerson.institution', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-gray-600">
              Due Date
            </label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
