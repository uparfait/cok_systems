import { useState } from 'react';
import { FiSearch, FiCheckCircle, FiXCircle, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';
import axios from 'axios';

const BASE_URL = '/cok/api/v1';

const inputClass = 'w-full px-4 py-2.5 cok-auth-input text-sm text-gray-900';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function CheckAvailability() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({
    roomName: '',
    startTime: '',
    endTime: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.get(`${BASE_URL}/rooms/availability`, {
        params: {
          roomName: formData.roomName,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString()
        }
      });
      setResult(response.data.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="p-6">
      <div className="max-w-lg mx-auto space-y-6">
        

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
              required
              placeholder="Enter room name"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="startTime" className={labelClass}>
              Start Time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="datetime-local"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
                min={getMinDateTime()}
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="endTime" className={labelClass}>
              End Time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="datetime-local"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
                min={formData.startTime || getMinDateTime()}
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.roomName || !formData.startTime || !formData.endTime}
            className="w-full  text-sm font-medium  disabled:opacity-50 disabled:cursor-not-allowed cok-btn-primary inline-flex items-center justify-center gap-2"
          >
            <FiSearch className="w-4 h-4" />
            {loading ? 'Checking...' : 'Check Availability'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div className={`bg-white border ppp-lg p-6 space-y-4 ${
            result.available ? 'border-green-200' : 'border-red-200'
          }`}>
            <div className="flex items-start gap-4">
              {result.available ? (
                <div className="w-10 h-10 bg-green-100 ppp-full flex items-center justify-center flex-shrink-0">
                  <FiCheckCircle className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-red-100 ppp-full flex items-center justify-center flex-shrink-0">
                  <FiXCircle className="w-5 h-5 text-red-600" />
                </div>
              )}
              <div className="space-y-2">
                <h3 className={`text-lg font-bold ${result.available ? 'text-green-700' : 'text-red-700'}`}>
                  {result.available ? 'Room is Available!' : 'Room is Not Available'}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FiMapPin className="w-4 h-4" />
                  <span>{formData.roomName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FiCalendar className="w-4 h-4" />
                  <span>
                    {new Date(formData.startTime).toLocaleString()} - {new Date(formData.endTime).toLocaleString()}
                  </span>
                </div>

                {!result.available && result.conflict && (
                  <div className="mt-3 p-3 bg-red-50 ppp-lg border border-red-100">
                    <p className="text-sm font-medium text-red-800">Scheduling Conflict</p>
                    <p className="text-xs text-red-600 mt-1">
                      {result.conflict.type}: {result.conflict.details?.eventName || 'Another event is scheduled during this time'}
                    </p>
                    {result.conflict.details?.eventOrganizer && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Organized by: {result.conflict.details.eventOrganizer}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}