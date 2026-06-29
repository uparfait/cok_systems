import { FiMapPin } from 'react-icons/fi';

const selectClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-2';

export default function RoomSelect({ value, rooms, loading, selectedRoom, onChange }) {
  return (
    <div className="space-y-2">
      <label htmlFor="eventRoom" className={labelClass}>
        Target Room<span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
        <select
          id="eventRoom"
          value={value}
          onChange={(e) => onChange('eventRoom', e.target.value)}
          required
          className={`${selectClass} pl-10`}
        >
          <option value="" disabled>
            {loading ? 'Querying rooms…' : 'Select target workspace'}
          </option>
          {rooms.map((r) => (
            <option key={r._id} value={r.roomName}>
              {r.roomName} — Cap: {r.roomCapacity} — {r.roomLocation || 'N/A'}
            </option>
          ))}
        </select>
      </div>
      {selectedRoom && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 ppp-lg px-3 py-2">
          <span><strong>Capacity:</strong> {selectedRoom.roomCapacity}</span>
          <span><strong>Location:</strong> {selectedRoom.roomLocation || 'N/A'}</span>
          {selectedRoom.isActive && (
            <span className="text-green-600 font-bold">{selectedRoom.roomName}</span>
          )}
        </div>
      )}
    </div>
  );
}