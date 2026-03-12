// VisitorFilter Component - Visitor filtering controls
// Provides filter options for searching visitors

import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiFilter, 
  FiX, 
  FiCalendar, 
  FiUsers,
  FiBriefcase,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';
import { getDepartments } from '../services/serviceDeliveryService';

export type VisitorStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out';

interface VisitorFilterProps {
  onFilterChange: (filters: FilterState) => void;
  onSearch?: (query: string) => void;
  showAdvanced?: boolean;
  initialFilters?: Partial<FilterState>;
}

export interface FilterState {
  search: string;
  status: VisitorStatus | '';
  department: string;
  dateFrom: string;
  dateTo: string;
  hasVehicle: boolean | null;
}

// Status options
const statusOptions: { value: VisitorStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_service', label: 'In Service' },
  { value: 'completed', label: 'Completed' },
  { value: 'checked_out', label: 'Checked Out' },
];

// Vehicle options
const vehicleOptions = [
  { value: null, label: 'All' },
  { value: true, label: 'With Vehicle' },
  { value: false, label: 'Without Vehicle' },
];

const VisitorFilter: React.FC<VisitorFilterProps> = ({
  onFilterChange,
  onSearch,
  showAdvanced = true,
  initialFilters,
}) => {
  const [isExpanded, setIsExpanded] = useState(showAdvanced);
  const [departments, setDepartments] = useState<{ _id: string; department_name: string }[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: initialFilters?.search || '',
    status: initialFilters?.status || '',
    department: initialFilters?.department || '',
    dateFrom: initialFilters?.dateFrom || '',
    dateTo: initialFilters?.dateTo || '',
    hasVehicle: initialFilters?.hasVehicle ?? null,
  });

  // Load departments
  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const response = await getDepartments();
      if (response.status && response.data) {
        setDepartments(response.data);
      }
    } catch (error) {
      // Use empty array if API fails
      console.error('Failed to load departments:', error);
    }
  };

  // Handle filter change
  const handleFilterChange = (key: keyof FilterState, value: string | boolean | null) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(filters.search);
    }
    onFilterChange(filters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
      search: '',
      status: '',
      department: '',
      dateFrom: '',
      dateTo: '',
      hasVehicle: null,
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = 
    filters.status !== '' || 
    filters.department !== '' || 
    filters.dateFrom !== '' || 
    filters.dateTo !== '' || 
    filters.hasVehicle !== null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Search Bar (Always Visible) */}
      <form onSubmit={handleSearchSubmit} className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, national ID, or phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Quick Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Expand/Collapse Button */}
          {showAdvanced && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                hasActiveFilters 
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiFilter />
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  !
                </span>
              )}
              {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          )}
        </div>
      </form>

      {/* Advanced Filters (Expandable) */}
      {showAdvanced && isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiUsers className="inline mr-1" /> Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.department_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiCalendar className="inline mr-1" /> From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiCalendar className="inline mr-1" /> To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Vehicle Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiBriefcase className="inline mr-1" /> Vehicle
              </label>
              <select
                value={filters.hasVehicle === null ? 'all' : filters.hasVehicle.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFilterChange('hasVehicle', val === 'all' ? null : val === 'true');
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Visitors</option>
                <option value="true">With Vehicle</option>
                <option value="false">Without Vehicle</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <FiX /> Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisitorFilter;
