import { FiSearch, FiPlus } from 'react-icons/fi';

export default function RoomsHeader({ 
  searchTerm, statusFilter, sortBy,
  onSearchChange, onStatusChange, onSortChange, onCreateClick 
}) {
  return (
    <div className="flex-shrink-0 bg-white border-b-2 border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 text-sm outline-none focus:border-[#1255e5] transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2.5 border-2 border-gray-300 text-sm bg-white outline-none focus:border-[#1255e5] transition-colors"
        >
          <option value="all">All Status</option>
          <option value="activeOnly">Active Only</option>
          <option value="inactiveOnly">Inactive Only</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-2.5 border-2 border-gray-300 text-sm bg-white outline-none focus:border-[#1255e5] transition-colors"
        >
          <option value="new">Newest First</option>
          <option value="old">Oldest First</option>
          <option value="name">Name A-Z</option>
          <option value="nameDesc">Name Z-A</option>
          <option value="capacity">Capacity Low</option>
          <option value="capacityDesc">Capacity High</option>
          <option value="location">Location</option>
        </select>

        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1255e5] text-white text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <FiPlus className="w-4 h-4" />
          Add Room
        </button>
      </div>
    </div>
  );
}