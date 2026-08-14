import { FiUser, FiCalendar, FiX } from 'react-icons/fi';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';
const inputStyle = { paddingLeft: '12px' };

const labelStyle = {
  fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', color: NEUTRAL_DARK,
  display: 'block', marginBottom: '6px',
};

export default function EventActionsCreateModal({ showModal, setShowModal, form, setField, formError, submitting, handleSubmit }) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>New Event Action</h2>
          <button onClick={() => setShowModal(false)} disabled={submitting} className="p-1.5 cursor-pointer transition-colors disabled:opacity-50" style={{ color: '#9E9E9E' }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-5">
          {formError && (
            <div className="p-3 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>{formError}</div>
          )}

          <div>
            <label style={labelStyle}>Title <span style={{ color: DANGER }}>*</span></label>
            <input type="text" required maxLength={200} value={form.title}
              onChange={e => setField('title', e.target.value)} placeholder="Action title"
              className={inputClassName} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
            <textarea required maxLength={2000} rows={3} value={form.actionDescription}
              onChange={e => setField('actionDescription', e.target.value)} placeholder="Describe the action…"
              className={inputClassName} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} />
          </div>

          <div>
            <label style={labelStyle}>
              <FiUser className="w-3 h-3 inline mr-1" style={{ color: PRIMARY }} />Assigned Person <span style={{ color: DANGER }}>*</span>
            </label>
            <div className="space-y-2">
              <input type="text" required maxLength={200} value={form.assignedPerson.name}
                onChange={e => setField('assignedPerson.name', e.target.value)} placeholder="Full name"
                className={inputClassName} style={inputStyle} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" required maxLength={200} value={form.assignedPerson.role}
                  onChange={e => setField('assignedPerson.role', e.target.value)} placeholder="Role"
                  className={inputClassName} style={inputStyle} />
                <input type="text" required maxLength={300} value={form.assignedPerson.institution}
                  onChange={e => setField('assignedPerson.institution', e.target.value)} placeholder="Institution"
                  className={inputClassName} style={inputStyle} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>
                <FiCalendar className="w-3 h-3 inline mr-1" style={{ color: PRIMARY }} />Due Date <span style={{ color: DANGER }}>*</span>
              </label>
              <input type="date" required value={form.dueDate}
                onChange={e => setField('dueDate', e.target.value)}
                className={inputClassName} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Event ID <span style={{ color: DANGER }}>*</span></label>
              <input type="text" required value={form.eventSpecialId}
                onChange={e => setField('eventSpecialId', e.target.value)} placeholder="Event special ID"
                className={inputClassName} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Status <span style={{ color: DANGER }}>*</span></label>
            <div className="space-y-2">
              <select value={form.currentStatus.status}
                onChange={e => setField('currentStatus.status', e.target.value)}
                className={inputClassName} style={inputStyle}>
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
              <textarea required maxLength={1000} rows={2} value={form.currentStatus.description}
                onChange={e => setField('currentStatus.description', e.target.value)} placeholder="Status note…"
                className={inputClassName} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} />
            </div>
          </div>

          <div className="flex gap-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <button type="button" onClick={() => setShowModal(false)} disabled={submitting}
              className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
              Discard
            </button>
            <button type="submit" disabled={submitting}
              className="cok-btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ width: 'auto' }}>
              {submitting ? 'Saving…' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
