import { useState, useEffect, useCallback } from 'react';
import { FiX, FiMapPin, FiCheckCircle, FiAlertTriangle, FiSearch } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../SpiralLoader';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const PRIMARY_TINT = '#E3F2FD';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

export default function ChangeRoomModal({ isOpen, onClose, event, eventMode, onSuccess }) {
  const [rooms, setRooms] = useState({ available: [], unavailable: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState('');
  const { showSuccess, showError } = useToast();

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
      setError(err.response?.data?.message || err.message);
      showError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventMode, event.startedAt, event.willEndAt, event.willStartAt, event.eventRecurring, event.eventSpecialId, event.eventRoom]);

  useEffect(() => {
    if (!isOpen) return;
    fetchRoomAvailability();
  }, [isOpen, fetchRoomAvailability]);

  const handleSave = async () => {
    if (!selectedRoom) {
      showError('Please select a room');
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
        showSuccess(res.data.message || 'Room changed successfully');
        onSuccess?.(res.data.data);
        onClose();
      } else {
        showError(res.data.message || 'Failed to change room');
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <FiMapPin className="w-5 h-5" style={{ color: PRIMARY }} />
            <h2 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Change Room</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1 cursor-pointer transition-colors disabled:opacity-50" style={{ color: GRAY_DISABLED }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="p-3" style={{ backgroundColor: PRIMARY_TINT, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              Current room: <strong className="capitalize">{event.eventRoom}</strong>. Select a new available room below.
            </p>
          </div>

          {error && (
            <div className="p-3" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1' }}>
              <p className="text-xs" style={{ color: '#E74C3C', fontFamily: fontHeading }}>{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6"><SpiralLoader /></div>
              <span className="ml-2 text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Checking room availability...</span>
            </div>
          )}

          {!loading && rooms.available.length === 0 && rooms.unavailable.length === 0 && (
            <div className="p-4 text-center" style={{ backgroundColor: '#F7F9FB', border: `1px solid ${BORDER}` }}>
              <FiSearch className="w-6 h-6 mx-auto mb-2" style={{ color: GRAY_DISABLED }} />
              <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No room data available. Try refreshing.</p>
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

        <div className="flex gap-3 px-4 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} disabled={saving}
            className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !selectedRoom || loading}
            className="cok-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ width: 'auto' }}>
            {saving ? 'Changing...' : 'Change Room'}
          </button>
        </div>
      </div>
    </div>
  );
}