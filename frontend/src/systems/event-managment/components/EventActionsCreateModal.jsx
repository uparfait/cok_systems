import { useState } from 'react';
import { FiUser, FiCalendar } from 'react-icons/fi';

const PRIMARY = '#056daa';
const NEUTRAL_LIGHT = '#F7F9FB';

export default function EventActionsCreateModal({ showModal, setShowModal, form, setForm, setField, formError, submitting, handleSubmit }) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 0 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E0E0E0' }}>
          <h2 className="text-lg font-bold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>New Event Action</h2>
          <button onClick={() => setShowModal(false)} className="p-1.5 transition-colors" style={{ color: '#888888' }}>
            <span style={{ fontSize: '20px' }}>×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {formError && (
            <div className="p-3 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Title *</label>
            <input type="text" required maxLength={200} value={form.title}
              onChange={e => setField('title', e.target.value)} placeholder="Action title"
              className="w-full px-4 py-3 text-sm outline-none"
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Description *</label>
            <textarea required maxLength={2000} rows={3} value={form.actionDescription}
              onChange={e => setField('actionDescription', e.target.value)} placeholder="Describe the action…"
              className="w-full px-4 py-3 text-sm outline-none resize-none"
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
              <FiUser className="w-3 h-3 inline mr-1" />Assigned Person *
            </label>
            <div className="space-y-2">
              <input type="text" required maxLength={200} value={form.assignedPerson.name}
                onChange={e => setField('assignedPerson.name', e.target.value)} placeholder="Full name"
                className="w-full px-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                  backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required maxLength={200} value={form.assignedPerson.role}
                  onChange={e => setField('assignedPerson.role', e.target.value)} placeholder="Role"
                  className="px-4 py-3 text-sm outline-none"
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                    backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                />
                <input type="text" required maxLength={300} value={form.assignedPerson.institution}
                  onChange={e => setField('assignedPerson.institution', e.target.value)} placeholder="Institution"
                  className="px-4 py-3 text-sm outline-none"
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                    backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                <FiCalendar className="w-3 h-3 inline mr-1" />Due Date *
              </label>
              <input type="date" required value={form.dueDate}
                onChange={e => setField('dueDate', e.target.value)}
                className="w-full px-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                  backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Event ID *</label>
              <input type="text" required value={form.eventSpecialId}
                onChange={e => setField('eventSpecialId', e.target.value)} placeholder="EVT-001"
                className="w-full px-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                  backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Status *</label>
            <div className="space-y-2">
              <select value={form.currentStatus.status}
                onChange={e => setField('currentStatus.status', e.target.value)}
                className="w-full px-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                  backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
              >
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
              <textarea required maxLength={1000} rows={2} value={form.currentStatus.description}
                onChange={e => setField('currentStatus.description', e.target.value)} placeholder="Status note…"
                className="w-full px-4 py-3 text-sm outline-none resize-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                  backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#E0E0E0' }}>
            <button type="button" onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium border transition-colors"
              style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}>
              Discard
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white rounded-none transition-colors disabled:opacity-60"
              style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
              {submitting ? 'Saving…' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
