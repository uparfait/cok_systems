// DepartmentAvailability Component - Real-time monitoring dashboard for receptionist guidance

import { useState, useEffect } from "react";
import {
  FiSearch, FiMapPin, FiCheckCircle, FiClock, FiAlertCircle,
  FiUsers, FiInfo, FiChevronRight, FiXCircle
} from "react-icons/fi";
import QueueStatusModal from "./QueueStatusModal";
import { departmentService, serviceDeliveryService } from "../../../../core/services/adminService";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

// Department data interface
interface DepartmentData {
  id: string;
  name: string;
  headName: string;
  status: 'available' | 'busy' | 'at_capacity' | 'closed';
  staffOnSite: number;
  waitingTime?: string;
  lastUpdated: string;
  queueCount?: number;
}

interface DepartmentAvailabilityProps {
  // Can optionally receive data from parent if available
  // Accepts either DepartmentData format or formattedDepartments format from ReceptionistDashboard
  departments?: {
    id?: string;
    _id?: string;
    department_id?: string;
    name?: string;
    department_name?: string;
    department_leader?: string;
    staffAvailable?: number;
    total_employees?: number;
    employees?: number;
    currentQueue?: number;
    isActive?: boolean;
  }[];
  visitorCounts?: Record<string, number>;
}

// Status configuration
const statusConfig = {
  available: {
    label: 'Available',
    color: 'text-[#388E3C]',
    bg: 'bg-[rgba(76,175,80,0.12)]',
    border: 'border-[#4CAF50]',
    dotColor: 'bg-[#4CAF50]'
  },
  busy: {
    label: 'Busy',
    color: 'text-[#D68910]',
    bg: 'bg-[rgba(243,156,18,0.12)]',
    border: 'border-[#F39C12]',
    dotColor: 'bg-[#F39C12]'
  },
  at_capacity: {
    label: 'At Capacity',
    color: 'text-[#E74C3C]',
    bg: 'bg-[rgba(231,76,60,0.12)]',
    border: 'border-[#E74C3C]',
    dotColor: 'bg-[#E74C3C]'
  },
  closed: {
    label: 'Closed',
    color: 'text-[#C0392B]',
    bg: 'bg-[rgba(192,57,43,0.15)]',
    border: 'border-[#C0392B]',
    dotColor: 'bg-[#C0392B]'
  },
};

const DepartmentAvailability: React.FC<DepartmentAvailabilityProps> = ({ departments: propDepartments, visitorCounts: propVisitorCounts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [departmentsData, setDepartmentsData] = useState<DepartmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch departments from backend if not provided via props
  useEffect(() => {
    const fetchData = async () => {
      // Use props if available, otherwise fetch from backend
      if (propDepartments && propDepartments.length > 0) {
        // Transform prop data to DepartmentData format
        const transformed = propDepartments.map((dept: any) => ({
          id: dept.id || dept._id || dept.department_id || '',
          name: dept.name || dept.department_name || '',
          headName: dept.department_leader || 'N/A',
          status: dept.status === 'Active' ? 'available' as const : 'busy' as const,
          staffOnSite: dept.staffAvailable || dept.total_employees || dept.employees || 0,
          waitingTime: dept.staffAvailable > 0 ? 'Staff available' : 'No staff on site',
          lastUpdated: 'Just now',
          queueCount: propVisitorCounts?.[dept.name || dept.department_name] || 0,
        }));
        setDepartmentsData(transformed);
        setIsLoading(false);
        return;
      }

      // Fetch from backend
      try {
        setIsLoading(true);
        const [deptRes, allVisitorsRes] = await Promise.all([
          departmentService.getAll(),
          serviceDeliveryService.getAll(1, 1000)
        ]);

        if (deptRes.success || deptRes.status) {
          const depts = Array.isArray(deptRes.data) ? deptRes.data : [];

          // Calculate visitor counts per department
          const allVisitors = allVisitorsRes.data || [];
          const counts: Record<string, number> = {};
          allVisitors.forEach((v: any) => {
            if (v.department) {
              counts[v.department] = (counts[v.department] || 0) + 1;
            }
          });

          const transformed = depts.map((dept: any) => ({
            id: dept._id || dept.department_id || '',
            name: dept.department_name || dept.name || '',
            headName: dept.department_leader || 'N/A',
            status: (dept.status === 'Active' ? 'available' : 'busy') as 'available' | 'busy' | 'at_capacity' | 'closed',
            staffOnSite: dept.total_employees || dept.employees || 0,
            waitingTime: (dept.total_employees || dept.employees || 0) > 0 ? 'Staff available' : 'No staff on site',
            lastUpdated: 'Just now',
            queueCount: counts[dept.department_name || dept.name] || 0,
          }));

          setDepartmentsData(transformed);
        }
      } catch (error) {
        console.error('Failed to fetch department data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propDepartments, propVisitorCounts]);

  const handleViewQueue = (deptName: string) => {
    setSelectedDepartment(deptName);
  };

  const handleCloseQueueModal = () => {
    setSelectedDepartment(null);
  };

  // Filter departments based on search and status
  const filteredDepartments = departmentsData.filter(dept => {
    const matchesSearch = searchTerm === '' ||
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.headName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = activeFilter === 'all' || dept.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  // Calculate KPIs
  const totalDepartments = departmentsData.length;
  const availableCount = departmentsData.filter(d => d.status === 'available').length;
  const busyCount = departmentsData.filter(d => d.status === 'busy').length;
  const atCapacityCount = departmentsData.filter(d => d.status === 'at_capacity').length;
  const closedCount = departmentsData.filter(d => d.status === 'closed').length;

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="p-6 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        <h1 className="text-2xl mb-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Department Availability</h1>
        <p style={{ color: '#555555' }}>
          Real-time monitoring dashboard for receptionist guidance across all City of Kigali bureaus.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total Departments Card */}
        <div className="p-4 flex items-center justify-between" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div>
            <p className="text-sm text-gray-500">Total Departments</p>
            <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{totalDepartments}</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}>
            <FiMapPin className="text-xl" style={{ color: PRIMARY }} />
          </div>
        </div>

        {/* Currently Available Card */}
        <div className="h-30 p-4 flex items-center justify-between" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div>
            <p className="text-sm text-gray-500">Currently Available</p>
            <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: SUCCESS }}>{availableCount}</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: 'rgba(76,175,80,0.12)', borderRadius: 0 }}>
            <FiCheckCircle className="text-xl" style={{ color: SUCCESS }} />
          </div>
        </div>

        {/* Busy/In Meeting Card */}
        <div className="p-4 flex items-center justify-between" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div>
            <p className="text-sm text-gray-500">Busy/In Meeting</p>
            <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: WARNING }}>{busyCount}</p>
            <p className="text-xs" style={{ color: GRAY_DISABLED }}>wait times expected</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: 'rgba(243,156,18,0.12)', borderRadius: 0 }}>
            <FiClock className="text-xl" style={{ color: WARNING }} />
          </div>
        </div>

        {/* Closed/At Capacity Card */}
        <div className="p-4 flex items-center justify-between" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div>
            <p className="text-sm text-gray-500">Closed/At Capacity</p>
            <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: DANGER }}>{atCapacityCount + closedCount}</p>
            <p className="text-xs" style={{ color: GRAY_DISABLED }}>requires rescheduling</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: 'rgba(231,76,60,0.12)', borderRadius: 0 }}>
            <FiXCircle className="text-xl" style={{ color: DANGER }} />
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="p-4 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: GRAY_DISABLED }} />
            <input
              type="text"
              placeholder="search departments or head of department...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 focus:outline-none transition-all"
              style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {/* All Departments */}
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-[rgba(5,109,170,0.12)] text-[#056daa]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#056daa]"></span>
              All Department
            </button>

            {/* Available */}
            <button
              onClick={() => setActiveFilter('available')}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === 'available'
                  ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#4CAF50]"></span>
              Available
            </button>

            {/* Busy */}
            <button
              onClick={() => setActiveFilter('busy')}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === 'busy'
                  ? 'bg-[rgba(243,156,18,0.12)] text-[#D68910]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F39C12]"></span>
              Busy
            </button>

            {/* At Capacity */}
            <button
              onClick={() => setActiveFilter('at_capacity')}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === 'at_capacity'
                  ? 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>
              At Capacity
            </button>

            {/* Closed */}
            <button
              onClick={() => setActiveFilter('closed')}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === 'closed'
                  ? 'bg-[rgba(192,57,43,0.15)] text-[#C0392B]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#C0392B]"></span>
              Closed
            </button>
          </div>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-3 gap-4 h-100">
        {filteredDepartments.map((dept) => {
          const status = statusConfig[dept.status];

          return (
            <div
              key={dept.id}
              className={`overflow-hidden border-t-4 ${status.border}`}
              style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>{dept.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Head: {dept.headName}</p>
              </div>

              {/* Staff Info Card */}
              <div className="mx-4 mb-2">
                <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.12)', borderRadius: 0 }}>
                      <FiInfo className="text-xs" style={{ color: PRIMARY }} />
                    </div>
                    <p className="text-sm text-gray-700">
                      {dept.waitingTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm" style={{ color: GRAY_DISABLED }}>
                  <FiClock className="text-xs" />
                  <span>updated {dept.lastUpdated}</span>
                </div>
                <button
                  onClick={() => handleViewQueue(dept.name)}
                  className="text-sm font-medium flex items-center gap-1 transition-colors"
                  style={{ color: PRIMARY }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
                >
                  View Queue
                  <FiChevronRight className="text-xs" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDepartments.length === 0 && (
        <div className="text-center py-12">
          <FiSearch className="mx-auto text-gray-300 text-4xl mb-4" />
          <p className="text-gray-500">No departments found matching your search.</p>
        </div>
      )}
      {/* Queue Status Modal */}
      {selectedDepartment && (
        <QueueStatusModal
          isOpen={!!selectedDepartment}
          onClose={handleCloseQueueModal}
          departmentName={selectedDepartment}
        />
      )}
    </div>
  );
};

export default DepartmentAvailability;
