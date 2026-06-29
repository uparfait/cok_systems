import { useState, useEffect, useCallback } from 'react';
import { FiX, FiMapPin, FiCheckCircle, FiAlertTriangle, FiSearch } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function ChangeRoomModal({ isOpen, onClose, event, eventMode, onSuccess }) {
  const [rooms, setRooms] = useState({ available: [], unavailable: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState('');

  const fetchRoomAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let params = { eventMode };

      if (eventMode === 'live') {
        const start = event.startedAt || new Date().toISOString();
        const end = event.willEndAt || new Date(Date.now() + 3600000).toISOString();
        params.startTime = new Date(start).toISOString();
        params.endTime = new Date(end).toISOString();
      } else if (eventMode === 'upcoming') {
        const start = event.willStartAt || new Date().toISOString();
        const end = event.willEndAt || new Date(Date.now() + 3600000).toISOString();
        params.startTime = new Date(start).toISOString();
        params.endTime = new Date(end).toISOString();
      } else if (eventMode === 'recurring') {
        const rc = event.eventRecurring;
        if (rc?.eventStartTime && rc?.eventEndTime && rc?.recurringEndDate) {
          params.recurringType = rc.recurringType || 'Weekly';
          params.eventStartTime = rc.eventStartTime;
          params.eventEndTime = rc.eventEndTime;
          params.recurringEndDate = new Date(rc.recurringEndDate).toISOString();
          params.startTime = new Date().toISOString();
          params.endTime = new Date(rc.recurringEndDate).toISOString();
          if (rc.weeklyDays?.length) params.weeklyDays = rc.weeklyDays.join(',');
          if (rc.monthlyPattern) params.monthlyPattern = rc.monthlyPattern;
          if (rc.monthlyDates?.length) params.monthlyDates = rc.monthlyDates.join(',');
        } else {
          throw new Error('Recurring configuration is incomplete for availability check');
        }
      }

      // Pass the current event's special ID so the backend can exclude it from conflict checks
      if (event.eventSpecialId) {
        params.excludeEventId = event.eventSpecialId;
      }

      const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
      const data = res.data?.data || res.data;
      
      // Filter out the current room from available list if it's already there
      const currentRoomName = event.eventRoom?.toLowerCase();
      const filteredAvailable = (data.availableRooms || []).filter(
        r => r.room.roomName?.toLowerCase() !== currentRoomName
      );
      const filteredUnavailable = (data.unavailableRooms || []).filter(
        r => r.room.roomName?.toLowerCase() !== currentRoomName
      );

      setRooms({
        available: filteredAvailable,
        unavailable: filteredUnavailable,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check room availability');
    } finally {
      setLoading(false);
    }
  }, [eventMode, event.startedAt, event.willEndAt, event.willStartAt, event.eventRecurring, event.eventSpecialId, event.eventRoom]);

  useEffect(() => {
    if (!isOpen) return;
    fetchRoomAvailability();
  }, [isOpen, fetchRoomAvailability]);

  const handleSave = async () => {
    if (!selectedRoom) {
      setError('Please select a room');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'room',
        data: { eventRoom: selectedRoom },
      });
      if (res.data.success) {
        onSuccess?.(res.data.data);
        onClose();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change room');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white ppp-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FiMapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">Change Room</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 ppp-lg transition-colors">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 ppp-lg p-3">
            <p className="text-xs text-blue-700">
              Current room: <strong className="capitalize">{event.eventRoom}</strong>. Select a new available room below.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 ppp-lg p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6"><SpiralLoader /></div>
              <span className="ml-2 text-sm text-gray-500">Checking room availability...</span>
            </div>
          )}

          {!loading && rooms.available.length === 0 && rooms.unavailable.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 ppp-lg p-4 text-center">
              <FiSearch className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No room data available. Try refreshing.</p>
            </div>
          )}

          {!loading && rooms.available.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Available Rooms ({rooms.available.length})</p>
              <div className="space-y-2">
                {rooms.available.map((item, idx) => {
                  const isSelected = selectedRoom === item.room.roomName;
                  const isCurrent = item.room.roomName.toLowerCase() === event.eventRoom?.toLowerCase();
                  return (
                    <button key={idx} type="button"
                      onClick={() => setSelectedRoom(item.room.roomName)}
                      className={`w-full text-left p-3 border-2 ppp-lg transition-all duration-200 ${
                        isSelected
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                          : 'border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FiCheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-green-600' : 'text-green-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                              {item.room.roomName}
                              {isCurrent && <span className="ml-2 text-[10px] text-gray-400 font-normal">(current)</span>}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" /> {item.room.roomLocation}</span>
                              <span>Capacity: {item.room.roomCapacity}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 ppp-lg shrink-0">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && rooms.unavailable.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">Unavailable ({rooms.unavailable.length})</p>
              <div className="space-y-2">
                {rooms.unavailable.map((item, idx) => (
                  <div key={idx} className="p-3 border border-orange-200 bg-orange-50/50 ppp-lg opacity-80 cursor-not-allowed">
                    <div className="flex items-start gap-2">
                      <FiAlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-500 capitalize truncate">{item.room.roomName}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" /> {item.room.roomLocation}</span>
                          <span>Capacity: {item.room.roomCapacity}</span>
                        </div>
                        <p className="text-xs text-orange-600 mt-1.5 font-medium bg-orange-100/70 p-1.5 ppp-lg">{item.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 ppp-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !selectedRoom || loading}
            className="flex-1 py-2.5 bg-blue-600 text-white ppp-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {saving ? 'Changing...' : 'Change Room'}
          </button>
        </div>
      </div>
    </div>
  );
}