import { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function EditRoomForm({ roomId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    roomName: '',
    roomDescription: '',
    roomCapacity: '',
    roomLocation: '',
    isActive: true
  });

  useEffect(() => {
    if (roomId) fetchRoom();
  }, [roomId]);

  const fetchRoom = async () => {
    setFetching(true);
    try {
      const response = await axios.get(`${BASE_URL}/rooms/${roomId}`);
      const room = response.data.data || response.data;
      setFormData({
        roomName: room.roomName || '',
        roomDescription: room.roomDescription || '',
        roomCapacity: room.roomCapacity || '',
        roomLocation: room.roomLocation || '',
        isActive: room.isActive ?? true
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch room');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await axios.put(`${BASE_URL}/rooms/${roomId}`, {
        ...formData,
        roomCapacity: parseInt(formData.roomCapacity)
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update room');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white ppp-xl shadow-xl p-8">
          <div className="animate-spin ppp-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-3">Loading room details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white ppp-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Edit Room</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 ppp-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 ppp-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>Room Name <span className="text-red-500">*</span></label>
            <input type="text" name="roomName" value={formData.roomName} onChange={handleChange} required className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Description <span className="text-red-500">*</span></label>
            <textarea name="roomDescription" value={formData.roomDescription} onChange={handleChange} required rows={3} className={`${inputClass} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Capacity <span className="text-red-500">*</span></label>
              <input type="number" name="roomCapacity" value={formData.roomCapacity} onChange={handleChange} required min="1" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Location <span className="text-red-500">*</span></label>
              <input type="text" name="roomLocation" value={formData.roomLocation} onChange={handleChange} required className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 ppp-lg">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 ppp focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">Active Room</label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 ppp-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium ppp-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 shadow-sm">
              <FiSave className="w-4 h-4" />
              {loading ? 'Saving...' : 'Update Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}