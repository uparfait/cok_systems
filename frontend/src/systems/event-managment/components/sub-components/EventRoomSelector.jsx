import { useState, useEffect } from 'react';
import { FiMapPin, FiCheckCircle, FiAlertTriangle, FiSearch, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function EventRoomSelector({ eventMode, formData, onChange, recurringType, monthlyPattern, excludeEventId }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableRooms, setUnavailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const getStartEnd = () => {
    if (eventMode === 'live') return { startTime: formData.startedAt, endTime: formData.willEndAt };
    if (eventMode === 'upcoming') return { startTime: formData.willStartAt, endTime: formData.willEndAt };
    if (eventMode === 'recurring') {
      // For recurring, use eventStartDate if provided, otherwise use today as range start
      const startDate = formData.eventStartDate || new Date().toISOString().split('T')[0];
      return { startTime: startDate, endTime: formData.recurringEndDate || '' };
    }
    return { startTime: '', endTime: '' };
  };

  const hasDates = () => {
    const { startTime, endTime } = getStartEnd();
    return startTime && endTime;
  };

  // For recurring events we must wait until the schedule is fully specified,
  // otherwise the backend generates zero occurrence dates and reports every
  // room as unavailable (false positive) or runs an incomplete check.
  const canCheckAvailability = () => {
    if (!hasDates()) return false;
    if (eventMode !== 'recurring') return true;
    if (!formData.eventStartTime || !formData.eventEndTime || !recurringType) return false;
    if (recurringType === 'Weekly' && (!formData.weeklyDays || formData.weeklyDays.length === 0)) return false;
    if (recurringType === 'Monthly' && (monthlyPattern === 'specific' || monthlyPattern === 'mixed') && !(formData.monthlyDates && formData.monthlyDates.trim())) return false;
    return true;
  };

  const fetchAvailableRooms = async () => {
    const { startTime, endTime } = getStartEnd();
    if (!startTime || !endTime) return;

    setLoading(true);
    setError(null);
    setSearched(false);

    try {
      const params = {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        eventMode,
      };

       if (eventMode === 'recurring' && formData.recurringEndDate) {
         params.recurringType = recurringType || 'Weekly';
         params.eventStartTime = formData.eventStartTime;
         params.eventEndTime = formData.eventEndTime;
         params.recurringEndDate = new Date(formData.recurringEndDate).toISOString();
         params.startTime = new Date().toISOString();
         params.endTime = new Date(formData.recurringEndDate).toISOString();
         params.monthlyPattern = monthlyPattern || 'specific';
         if (formData.weeklyDays?.length) {
           params.weeklyDays = formData.weeklyDays.join(',');
         } else if (recurringType === 'Weekly') {
           // Default: use current day of week if no days selected yet
           params.weeklyDays = String(new Date().getDay());
         }
         if (formData.monthlyDates && (monthlyPattern === 'specific' || monthlyPattern === 'mixed')) {
           params.monthlyDates = formData.monthlyDates;
         }
       }

       if (excludeEventId) {
         params.excludeEventId = excludeEventId;
       }

       const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
      const data = res.data?.data || res.data;
      setAvailableRooms(data.availableRooms || []);
      setUnavailableRooms(data.unavailableRooms || []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check room availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canCheckAvailability()) fetchAvailableRooms();
    else {
      // Reset stale results so the UI doesn't show availability for an incomplete schedule
      setAvailableRooms([]);
      setUnavailableRooms([]);
      setSearched(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.startedAt,
    formData.willStartAt,
    formData.willEndAt,
    formData.eventStartDate,
    formData.recurringEndDate,
    formData.eventStartTime,
    formData.eventEndTime,
    formData.weeklyDays,
    formData.monthlyDates,
    recurringType,
    monthlyPattern,
    eventMode,
  ]);

  const handleSelectRoom = (roomName) => {
    onChange('eventRoom', roomName);
  };

  const isRoomSelected = (roomName) => formData.eventRoom?.toLowerCase() === roomName.toLowerCase();

  // Hide rooms that cannot hold the expected audience
  const audience = formData.expectedAudience;
  const displayedAvailable = availableRooms.filter(
    (item) => !audience || Number(item.room?.roomCapacity) >= Number(audience)
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#056daa', fontFamily: "'Montserrat', sans-serif" }}>Room Selection</h2>
      <p className="text-xs text-gray-500">Rooms are checked for availability based on your selected schedule.</p>

      {(loading && !searched) && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6"><SpiralLoader /></div>
          <span className="ml-2 text-sm text-gray-500">Checking rooms...</span>
        </div>
      )}

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 ppp-lg p-3 flex items-start gap-2">
          <FiAlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-700">{error}</p>
        </div>
      )}

      {!hasDates() && !loading && (
        <div className="bg-gray-50 border border-gray-200 ppp-lg p-4 text-center">
          <FiSearch className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Set your schedule first, then rooms will be checked automatically.</p>
        </div>
      )}

      {hasDates() && !loading && searched && (
        <div className="space-y-2">
          {formData.eventRoom && !displayedAvailable.find(r => r.room.roomName.toLowerCase() === formData.eventRoom.toLowerCase()) && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 mb-3">
              <p className="text-xs text-yellow-700 font-medium">
                Previously selected room "{formData.eventRoom}" is no longer available with current settings.
              </p>
            </div>
          )}
          {displayedAvailable.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Available Rooms ({displayedAvailable.length})</p>
              <div className="space-y-2">
                {displayedAvailable.map((item, idx) => {
                  const selected = isRoomSelected(item.room.roomName);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectRoom(item.room.roomName)}
                      className={`w-full text-left p-3 border-2 ppp-lg transition-all duration-200 ${
                        selected
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                          : 'border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FiCheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? 'text-green-600' : 'text-green-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 capitalize truncate">{item.room.roomName}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" /> {item.room.roomLocation}</span>
                              <span>Capacity: {item.room.roomCapacity}</span>
                            </div>
                          </div>
                        </div>
                        {selected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 ppp-lg shrink-0">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {unavailableRooms.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">Unavailable Rooms ({unavailableRooms.length})</p>
              <div className="space-y-2">
                {unavailableRooms.map((item, idx) => (
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

          {displayedAvailable.length === 0 && availableRooms.length > 0 && (
            <div className="p-4 text-center" style={{ backgroundColor: '#FFF3E0', border: '1px solid #FFCC80' }}>
              <p className="text-xs font-semibold" style={{ color: '#333333' }}>No Rooms Match Capacity</p>
              <p className="text-xs mt-1" style={{ color: '#F39C12' }}>
                No available room can accommodate the expected audience of {audience}.
              </p>
            </div>
          )}

          {availableRooms.length === 0 && unavailableRooms.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 ppp-lg p-4 text-center">
              <p className="text-xs text-gray-500">No rooms found matching the criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}