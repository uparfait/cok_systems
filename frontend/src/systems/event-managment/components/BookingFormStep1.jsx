import { FiAlertCircle } from "react-icons/fi";

const EVENT_TYPES = [
  { value: "Internal", label: "Internal Meeting" },
  { value: "External", label: "External Meeting" },
  { value: "Joint", label: "Joint Meeting (Internal & External)" },
];

const inputClass =
  "w-full px-4 py-3 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

export default function BookingFormStep1({ form, rooms, roomsLoading, fieldErrors, handleChange }) {
  const selectedRoom = rooms.find((r) => r._id === form.room);
  const audienceExceedsCapacity =
    selectedRoom && form.audience && Number(form.audience) > selectedRoom.roomCapacity;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>
            Event Name <span className="text-red-500">*</span>
          </label>
          <input
            className={`${inputClass} ${fieldErrors.eventName ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
            type="text"
            name="eventName"
            value={form.eventName}
            onChange={handleChange}
            placeholder="Enter event designation"
          />
          {fieldErrors.eventName && <p className="text-xs text-red-500">{fieldErrors.eventName}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>
            Target Room Space <span className="text-red-500">*</span>
          </label>
          <select
            className={`${inputClass} ${fieldErrors.room ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
            name="room"
            value={form.room}
            onChange={handleChange}
          >
            <option value="" disabled>
              {roomsLoading ? "Loading rooms\u2026" : "Select workspace"}
            </option>
            {rooms.map((r) => (
              <option key={r._id} value={r.roomName}>
                {r.roomName} (Max: {r.roomCapacity})
              </option>
            ))}
          </select>
          {fieldErrors.room && <p className="text-xs text-red-500">{fieldErrors.room}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>
            Event Structural Type <span className="text-red-500">*</span>
          </label>
          <select
            className={`${inputClass} ${fieldErrors.eventType ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
            name="eventType"
            value={form.eventType}
            onChange={handleChange}
          >
            <option value="" disabled>
              Select event type
            </option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {fieldErrors.eventType && <p className="text-xs text-red-500">{fieldErrors.eventType}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>
            Expected Audience <span className="text-red-500">*</span>
          </label>
          <input
            className={`${inputClass} ${fieldErrors.audience ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
            type="number"
            name="audience"
            value={form.audience}
            onChange={handleChange}
            placeholder="Total head count"
            min={1}
          />
          {fieldErrors.audience && <p className="text-xs text-red-500">{fieldErrors.audience}</p>}
          {audienceExceedsCapacity && (
            <div className="mt-1 text-xs font-medium text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5">
              <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Exceeds room capacity ({selectedRoom.roomCapacity}).
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>
          Operational Scope Description <span className="text-red-500">*</span>
        </label>
        <textarea
          className={`${inputClass} resize-y min-h-[80px] ${fieldErrors.description ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Outline core requirements or high-level strategic summaries..."
          rows={3}
        />
        {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
      </div>
    </>
  );
}