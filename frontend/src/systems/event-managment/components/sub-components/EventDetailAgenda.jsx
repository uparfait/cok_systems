import { useState } from 'react';
import { FiClock, FiEdit2, FiCheck, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

export default function EventDetailAgenda({ event, eventMode, onEventUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAgenda, setEditAgenda] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const agenda = event.activityAgenda || [];
  const isPastEvent = eventMode === 'past';

  const startEditing = () => {
    setEditAgenda(agenda.length > 0 ? [...agenda] : [{ fromTime: '', toTime: '', title: '', description: '' }]);
    setIsEditing(true);
    setError(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const validItems = editAgenda.filter(a => a.title?.trim() || a.description?.trim());
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'agenda',
        data: { activityAgenda: validItems },
      });
      if (res.data.success) {
        onEventUpdated?.(res.data.data);
        setIsEditing(false);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update agenda');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setEditAgenda([...editAgenda, { fromTime: '', toTime: '', title: '', description: '' }]);
  };

  const removeItem = (idx) => {
    setEditAgenda(editAgenda.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...editAgenda];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditAgenda(updated);
  };

  if (!isEditing && agenda.length === 0) {
    return (
      <div className="bg-white ppp-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiClock className="w-4 h-4" />
            Activity Agenda
          </h3>
          {!isPastEvent && (
            <button onClick={startEditing}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              <FiPlus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400">No agenda items for this event.</p>
      </div>
    );
  }

  return (
    <div className="bg-white ppp-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <FiClock className="w-4 h-4" />
          Activity Agenda {!isEditing && `(${agenda.length})`}
        </h3>
        {!isPastEvent && !isEditing && (
          <button onClick={startEditing}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        {isEditing && (
          <span className="text-[10px] text-blue-600 font-medium">Editing...</span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {editAgenda.map((item, idx) => (
            <div key={idx} className="border border-blue-200 p-4 ppp-lg space-y-3 bg-blue-50/30">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-500">Item {idx + 1}</span>
                <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="time" value={item.fromTime} onChange={(e) => updateItem(idx, 'fromTime', e.target.value)}
                  className="px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
                <input type="time" value={item.toTime} onChange={(e) => updateItem(idx, 'toTime', e.target.value)}
                  className="px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <input type="text" value={item.title} onChange={(e) => updateItem(idx, 'title', e.target.value)}
                placeholder="Title" className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <textarea value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)}
                placeholder="Description" rows={2}
                className="w-full px-3 py-2 border border-gray-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          ))}
          <button onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <FiPlus className="w-3.5 h-3.5" /> Add item
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white ppp-lg text-xs hover:bg-blue-700 disabled:opacity-50">
              <FiCheck className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Agenda'}
            </button>
            <button onClick={cancelEditing}
              className="flex items-center gap-1 px-4 py-2 border border-gray-300 ppp-lg text-xs hover:bg-gray-50">
              <FiX className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {agenda.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 ppp-lg hover:bg-gray-100/50 transition-colors">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 ppp-full flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.title && <span className="font-semibold text-sm text-gray-900">{item.title}</span>}
                  {(item.fromTime || item.toTime) && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-0.5 ppp border border-gray-200">
                      <FiClock className="w-3 h-3" />
                      {item.fromTime || '--'} - {item.toTime || '--'}
                    </span>
                  )}
                </div>
                {item.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}