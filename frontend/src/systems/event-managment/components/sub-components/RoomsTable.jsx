import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import EditableCell from './EditableCell';

const COLUMNS = [
  { key: 'roomName', label: 'Room Name' },
  { key: 'roomCapacity', label: 'Capacity', type: 'number' },
  { key: 'roomLocation', label: 'Location' },
  { key: 'roomDescription', label: 'Description' },
  { key: 'isActive', label: 'Status' },
];

export default function RoomsTable({ rooms, saving, onSaveField, onEditClick, onDeleteClick, onQrCodeClick }) {
  if (rooms.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No rooms found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full border-collapse table-auto">
        <thead className="sticky top-0 z-10">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="bg-[#1255e5] text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest border-r border-blue-400 last:border-r-0">
                {col.label}
              </th>
            ))}
            <th className="bg-[#1255e5] text-white px-4 py-3.5 text-center text-xs font-bold uppercase tracking-widest">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room, rowIndex) => (
            <tr
              key={room._id}
              className={`transition-colors duration-100 ${
                rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50/50 hover:bg-blue-50/30'
              }`}
            >
              {COLUMNS.map((col) => (
                <td key={col.key} className="px-4 py-3 border-r border-gray-200 last:border-r-0 align-top">
                  <EditableCell
                    value={room[col.key]}
                    field={col.key}
                    roomId={room._id}
                    type={col.type || 'text'}
                    saving={saving}
                    onSave={onSaveField}
                  />
                </td>
              ))}
              <td className="px-4 py-3 align-top">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => onQrCodeClick?.(room)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                    title="Generate Room QR Code"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h1v1h-1zM14 14h3v3h-3zM20 14h1v1h-1zM14 17h1v1h-1zM17 17h4v4h-4zM10 7h1v1h-1zM7 10h1v1H7zM19 10h1v1h-1zM10 19h1v1h-1z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onEditClick(room._id)}
                    className="p-2 text-gray-400 hover:text-[#1255e5] hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all"
                    title="Edit Room"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteClick(room._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                    title="Delete Room"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}