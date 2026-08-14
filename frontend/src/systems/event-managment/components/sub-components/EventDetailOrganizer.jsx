import { useState } from 'react';
import { FiUser, FiMail, FiPhone, FiGlobe, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const PRIMARY_TINT = '#E3F2FD';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';

const fieldLabelStyle = {
  fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', color: GRAY_DISABLED,
  display: 'block', marginBottom: '4px',
};

export default function EventDetailOrganizer({ event, eventMode, onEventUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ fullNames: '', email: '', phone: '', institution: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useToast();

  const isPastEvent = eventMode === 'past';
  const organizer = typeof event.eventOrganizer === 'object'
    ? event.eventOrganizer
    : { fullNames: event.eventOrganizer || '', email: '', phone: '', institution: '' };

  const startEditing = () => {
    setForm({
      fullNames: organizer.fullNames || '',
      email: organizer.email || '',
      phone: organizer.phone || '',
      institution: organizer.institution || '',
    });
    setIsEditing(true);
    setError(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'organizer',
        data: { eventOrganizer: form },
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Organizer updated successfully');
        onEventUpdated?.(res.data.data);
        setIsEditing(false);
      } else {
        setError(res.data.message);
        showError(res.data.message || 'Failed to update organizer');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: PRIMARY, fontFamily: fontHeading }}>
          <FiUser className="w-4 h-4" />
          Organizer Details
        </h3>
        {!isPastEvent && !isEditing && (
          <button onClick={startEditing}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:underline"
            style={{ color: PRIMARY, fontFamily: fontHeading }}>
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={fieldLabelStyle}>Full Name</label>
              <input type="text" value={form.fullNames} onChange={(e) => setForm({ ...form, fullNames: e.target.value })}
                className={inputClassName} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClassName} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClassName} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Institution</label>
              <input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className={inputClassName} />
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="cok-btn-primary inline-flex items-center gap-1 disabled:opacity-50"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '11px' }}>
              <FiCheck className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Organizer'}
            </button>
            <button onClick={cancelEditing}
              className="cok-btn-outlined inline-flex items-center gap-1"
              style={{ padding: '0.5rem 1rem', fontSize: '11px' }}>
              <FiX className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: FiUser, label: 'Full Name', value: organizer.fullNames },
            { icon: FiMail, label: 'Email', value: organizer.email },
            { icon: FiPhone, label: 'Phone', value: organizer.phone },
            { icon: FiGlobe, label: 'Institution', value: organizer.institution },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ backgroundColor: PRIMARY_TINT }}>
                <Icon className="w-4 h-4" style={{ color: PRIMARY }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{label}</p>
                <p className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK }}>{value || 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}