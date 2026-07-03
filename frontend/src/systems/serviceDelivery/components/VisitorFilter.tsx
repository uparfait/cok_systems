import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiCalendar, FiUsers, FiBriefcase, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { getDepartments } from '../services/serviceDeliveryService';

export type VisitorStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'checked_out';
interface VisitorFilterProps { onFilterChange: (filters: FilterState) => void; onSearch?: (query: string) => void; showAdvanced?: boolean; initialFilters?: Partial<FilterState>; }
export interface FilterState { search: string; status: VisitorStatus | ''; department: string; dateFrom: string; dateTo: string; hasVehicle: boolean | null; }

const statusOptions: { value: VisitorStatus | ''; label: string }[] = [{ value: '', label: 'All Statuses' }, { value: 'pending', label: 'Pending' }, { value: 'assigned', label: 'Assigned' }, { value: 'in_service', label: 'In Service' }, { value: 'completed', label: 'Completed' }, { value: 'checked_out', label: 'Checked Out' }];

const VisitorFilter: React.FC<VisitorFilterProps> = ({ onFilterChange, onSearch, showAdvanced = true, initialFilters }) => {
  const [isExpanded, setIsExpanded] = useState(showAdvanced);
  const [departments, setDepartments] = useState<{ _id: string; department_name: string }[]>([]);
  const [filters, setFilters] = useState<FilterState>({ search: initialFilters?.search || '', status: initialFilters?.status || '', department: initialFilters?.department || '', dateFrom: initialFilters?.dateFrom || '', dateTo: initialFilters?.dateTo || '', hasVehicle: initialFilters?.hasVehicle ?? null });

  useEffect(() => { loadDepartments(); }, []);
  const loadDepartments = async () => { try { const r = await getDepartments(); if (r.status && r.data) setDepartments(r.data); } catch (error) { } };
  const handleFilterChange = (key: keyof FilterState, value: string | boolean | null) => { const n = { ...filters, [key]: value }; setFilters(n); onFilterChange(n); };
  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); if (onSearch) onSearch(filters.search); onFilterChange(filters); };
  const handleClearFilters = () => { const c: FilterState = { search: '', status: '', department: '', dateFrom: '', dateTo: '', hasVehicle: null }; setFilters(c); onFilterChange(c); };
  const hasActiveFilters = filters.status !== '' || filters.department !== '' || filters.dateFrom !== '' || filters.dateTo !== '' || filters.hasVehicle !== null;

  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <form onSubmit={handleSearchSubmit} className="p-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search by name, ID, or phone..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
          <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="border border-gray-300 px-3 py-1.5 text-sm">{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          {showAdvanced && <button type="button" onClick={() => setIsExpanded(!isExpanded)} className={`flex items-center gap-1.5 px-3 py-1.5 border text-sm ${hasActiveFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}><FiFilter className="w-3.5 h-3.5" />Filters{isExpanded ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}</button>}
        </div>
      </form>
      {showAdvanced && isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block"><FiUsers className="inline w-3 h-3 mr-0.5" />Department</label><select value={filters.department} onChange={e => handleFilterChange('department', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-sm"><option value="">All Departments</option>{departments.map(d => <option key={d._id} value={d._id}>{d.department_name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block"><FiCalendar className="inline w-3 h-3 mr-0.5" />From Date</label><input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block"><FiCalendar className="inline w-3 h-3 mr-0.5" />To Date</label><input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block"><FiBriefcase className="inline w-3 h-3 mr-0.5" />Vehicle</label><select value={filters.hasVehicle === null ? 'all' : filters.hasVehicle.toString()} onChange={e => { const v = e.target.value; handleFilterChange('hasVehicle', v === 'all' ? null : v === 'true'); }} className="w-full border border-gray-300 px-2.5 py-1.5 text-sm"><option value="all">All</option><option value="true">With Vehicle</option><option value="false">Without</option></select></div>
          </div>
          {hasActiveFilters && <div className="mt-3 flex justify-end"><button type="button" onClick={handleClearFilters} className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"><FiX className="w-3 h-3" />Clear All</button></div>}
        </div>
      )}
    </div>
  );
};

export default VisitorFilter;