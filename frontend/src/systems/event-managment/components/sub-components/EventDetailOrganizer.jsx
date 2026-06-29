import { useState } from 'react';
import { FiUser, FiMail, FiPhone, FiGlobe, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

export default function EventDetailOrganizer({ event, eventMode, onEventUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ fullNames: '', email: '', phone: '', institution: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
        onEventUpdated?.(res.data.data);
        setIsEditing(false);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update organizer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white ppp-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <FiUser className="w-4 h-4" />
          Organizer Details
        </h3>
        {!isPastEvent && !isEditing && (
          <button onClick={startEditing}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <input type="text" value={form.fullNames} onChange={(e) => setForm({ ...form, fullNames: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Institution</label>
              <input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white ppp-lg text-xs hover:bg-blue-700 disabled:opacity-50">
              <FiCheck className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Organizer'}
            </button>
            <button onClick={cancelEditing}
              className="flex items-center gap-1 px-4 py-2 border border-gray-300 ppp-lg text-xs hover:bg-gray-50">
              <FiX className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 ppp-full flex items-center justify-center shrink-0">
              <FiUser className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Full Name</p>
              <p className="text-sm font-medium text-gray-900 truncate">{organizer.fullNames || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-purple-100 ppp-full flex items-center justify-center shrink-0">
              <FiMail className="w-4 h-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900 truncate">{organizer.email || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-green-100 ppp-full flex items-center justify-center shrink-0">
              <FiPhone className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm font-medium text-gray-900">{organizer.phone || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-100 ppp-full flex items-center justify-center shrink-0">
              <FiGlobe className="w-4 h-4 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Institution</p>
              <p className="text-sm font-medium text-gray-900 truncate">{organizer.institution || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}