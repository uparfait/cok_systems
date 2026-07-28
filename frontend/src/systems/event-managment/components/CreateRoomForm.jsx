import { useState } from 'react';
import { FiArrowLeft, FiSave, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

const inputClass = 'w-full px-4 py-2.5 border cok-auth-input text-sm text-gray-900 placeholder-gray-400 focus:outline-none ';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function CreateRoomForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    roomName: '',
    roomDescription: '',
    roomCapacity: '',
    roomLocation: '',
    isActive: true
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.roomName.trim()) newErrors.roomName = 'Room name is required';
    if (!formData.roomDescription.trim()) newErrors.roomDescription = 'Description is required';
    if (!formData.roomCapacity || formData.roomCapacity < 1) newErrors.roomCapacity = 'Valid capacity is required';
    if (!formData.roomLocation.trim()) newErrors.roomLocation = 'Location is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${BASE_URL}/rooms`, {
        ...formData,
        roomCapacity: parseInt(formData.roomCapacity)
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/event-manager/rooms/all');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 ppp-lg p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 ppp-full flex items-center justify-center mx-auto">
              <FiCheck className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Room Created Successfully!</h2>
              <p className="text-sm text-gray-500 mt-1">Redirecting to rooms list...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-lg mx-auto">


        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 ppp-lg p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 ppp-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="roomName" className={labelClass}>
              Room Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="roomName"
              name="roomName"
              value={formData.roomName}
              onChange={handleChange}
              placeholder="e.g. Conference Room A"
              className={`${inputClass} ${errors.roomName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.roomName && <p className="text-xs text-red-500 mt-1">{errors.roomName}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="roomDescription" className={labelClass}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="roomDescription"
              name="roomDescription"
              value={formData.roomDescription}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of the room"
              className={`${inputClass} resize-none ${errors.roomDescription ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.roomDescription && <p className="text-xs text-red-500 mt-1">{errors.roomDescription}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="roomCapacity" className={labelClass}>
                Capacity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="roomCapacity"
                name="roomCapacity"
                value={formData.roomCapacity}
                onChange={handleChange}
                min="1"
                placeholder="e.g. 50"
                className={`${inputClass} ${errors.roomCapacity ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.roomCapacity && <p className="text-xs text-red-500 mt-1">{errors.roomCapacity}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="roomLocation" className={labelClass}>
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="roomLocation"
                name="roomLocation"
                value={formData.roomLocation}
                onChange={handleChange}
                placeholder="e.g. Building A, Floor 2"
                className={`${inputClass} ${errors.roomLocation ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.roomLocation && <p className="text-xs text-red-500 mt-1">{errors.roomLocation}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 ppp-lg">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 cok-primary-color"
            />
            <div>
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Set as Active
              </label>
              <p className="text-xs text-gray-500">Active rooms can be used for events immediately</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/event-manager/rooms/all')}
              className="flex-1 h-[45px] px-4  cok-btn-outlined text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5  text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cok-btn-primary inline-flex items-center justify-center gap-2"
            >
              <FiSave className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}