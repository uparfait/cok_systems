import { FiX } from 'react-icons/fi';

export default function RoomFormModal({ mode, formData, submitting, onChange, onSubmit, onClose }) {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-gray-300 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {mode === 'create' ? 'Create New Room' : 'Edit Room'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <FormField label="Room Name *">
            <input
              type="text"
              required
              value={formData.roomName}
              onChange={(e) => handleChange('roomName', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 text-sm outline-none focus:border-[#1255e5] transition-colors"
              placeholder="Enter room name"
            />
          </FormField>

          <FormField label="Description *">
            <textarea
              required
              value={formData.roomDescription}
              onChange={(e) => handleChange('roomDescription', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 text-sm outline-none focus:border-[#1255e5] transition-colors resize-none"
              rows={3}
              placeholder="Enter room description"
            />
          </FormField>

          <FormField label="Capacity *">
            <input
              type="number"
              required
              min="1"
              value={formData.roomCapacity}
              onChange={(e) => handleChange('roomCapacity', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 text-sm outline-none focus:border-[#1255e5] transition-colors"
              placeholder="Enter capacity"
            />
          </FormField>

          <FormField label="Location *">
            <input
              type="text"
              required
              value={formData.roomLocation}
              onChange={(e) => handleChange('roomLocation', e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 text-sm outline-none focus:border-[#1255e5] transition-colors"
              placeholder="Enter location"
            />
          </FormField>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-5 h-5 border-2 border-gray-300 text-[#1255e5] focus:ring-[#1255e5]"
            />
            <span className="text-sm font-bold text-gray-700">Active Room</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-[#1255e5] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : mode === 'create' ? 'Create Room' : 'Update Room'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 border-2 border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}