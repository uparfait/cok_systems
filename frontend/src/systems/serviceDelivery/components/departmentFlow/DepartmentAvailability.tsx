// DepartmentAvailability Component - Real-time monitoring dashboard for receptionist guidance

import { useState } from "react";
import { 
  FiSearch, FiMapPin, FiCheckCircle, FiClock, FiAlertCircle,
  FiUsers, FiInfo, FiChevronRight, FiXCircle
} from "react-icons/fi";
import QueueStatusModal from "./QueueStatusModal";

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

// Mock department data
const DEPARTMENTS_DATA: DepartmentData[] = [
  {
    id: '1',
    name: 'Land Bureau',
    headName: 'Sarah Murekatete',
    status: 'available',
    staffOnSite: 3,
    waitingTime: 'All staff available',
    lastUpdated: '5 mins ago',
    queueCount: 5,
  },
  {
    id: '2',
    name: 'Social Affairs',
    headName: 'Jean Paul N',
    status: 'busy',
    staffOnSite: 2,
    waitingTime: 'Current waiting time about 45 mins (on break)',
    lastUpdated: '12 mins ago',
    queueCount: 8,
  },
  {
    id: '3',
    name: 'Infrastructure',
    headName: 'Marie Claire U.',
    status: 'at_capacity',
    staffOnSite: 0,
    waitingTime: 'Queue full. No new tickets issued until 2:00 PM',
    lastUpdated: '2 mins ago',
    queueCount: 12,
  },
  {
    id: '4',
    name: 'Urban Planning',
    headName: 'Dr. Patrick K.',
    status: 'available',
    staffOnSite: 4,
    waitingTime: 'All staff Available',
    lastUpdated: '1 hour ago',
    queueCount: 3,
  },
  {
    id: '5',
    name: 'Public Health',
    headName: 'Beatrice M.',
    status: 'closed',
    staffOnSite: 0,
    waitingTime: '2 days meeting',
    lastUpdated: '4 hours ago',
    queueCount: 0,
  },
  {
    id: '6',
    name: 'Education Office',
    headName: 'Eric T.',
    status: 'busy',
    staffOnSite: 1,
    waitingTime: 'Staff in weekly meeting until 10:00AM',
    lastUpdated: '30 mins ago',
    queueCount: 6,
  },
];

// Status configuration
const statusConfig = {
  available: { 
    label: 'Available', 
    color: 'text-green-600', 
    bg: 'bg-green-100', 
    border: 'border-green-500',
    dotColor: 'bg-green-500'
  },
  busy: { 
    label: 'Busy', 
    color: 'text-orange-600', 
    bg: 'bg-orange-100', 
    border: 'border-orange-500',
    dotColor: 'bg-orange-500'
  },
  at_capacity: { 
    label: 'At Capacity', 
    color: 'text-red-600', 
    bg: 'bg-red-100', 
    border: 'border-red-500',
    dotColor: 'bg-red-500'
  },
  closed: { 
    label: 'Closed', 
    color: 'text-red-800', 
    bg: 'bg-red-200', 
    border: 'border-red-800',
    dotColor: 'bg-red-800'
  },
};

const DepartmentAvailability: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const handleViewQueue = (deptName: string) => {
    setSelectedDepartment(deptName);
  };

  const handleCloseQueueModal = () => {
    setSelectedDepartment(null);
  };

  // Filter departments based on search and status
  const filteredDepartments = DEPARTMENTS_DATA.filter(dept => {
    const matchesSearch = searchTerm === '' || 
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.headName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || dept.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Calculate KPIs
  const totalDepartments = DEPARTMENTS_DATA.length;
  const availableCount = DEPARTMENTS_DATA.filter(d => d.status === 'available').length;
  const busyCount = DEPARTMENTS_DATA.filter(d => d.status === 'busy').length;
  const atCapacityCount = DEPARTMENTS_DATA.filter(d => d.status === 'at_capacity').length;
  const closedCount = DEPARTMENTS_DATA.filter(d => d.status === 'closed').length;

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="bg-sky-50 rounded-xl p-6 mb-6 border border-sky-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Department Availability</h1>
        <p className="text-gray-600">
          Real-time monitoring dashboard for receptionist guidance across all City of Kigali bureaus.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total Departments Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Total Departments</p>
            <p className="text-2xl font-bold text-gray-800">{totalDepartments}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <FiMapPin className="text-blue-600 text-xl" />
          </div>
        </div>

        {/* Currently Available Card */}
        <div className="bg-white rounded-xl h-30 shadow-sm p-4 flex items-center justify-between border border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Currently Available</p>
            <p className="text-2xl font-bold text-green-600">{availableCount}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
            <FiCheckCircle className="text-green-600 text-xl" />
          </div>
        </div>

        {/* Busy/In Meeting Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Busy/In Meeting</p>
            <p className="text-2xl font-bold text-orange-600">{busyCount}</p>
            <p className="text-xs text-gray-400">wait times expected</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
            <FiClock className="text-orange-600 text-xl" />
          </div>
        </div>

        {/* Closed/At Capacity Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Closed/At Capacity</p>
            <p className="text-2xl font-bold text-red-600">{atCapacityCount + closedCount}</p>
            <p className="text-xs text-gray-400">requires rescheduling</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
            <FiXCircle className="text-red-600 text-xl" />
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="search departments or head of department...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {/* All Departments */}
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'all' 
                  ? 'bg-sky-100 text-sky-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              All Department
            </button>

            {/* Available */}
            <button
              onClick={() => setActiveFilter('available')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'available' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Available
            </button>

            {/* Busy */}
            <button
              onClick={() => setActiveFilter('busy')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'busy' 
                  ? 'bg-orange-100 text-orange-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Busy
            </button>

            {/* At Capacity */}
            <button
              onClick={() => setActiveFilter('at_capacity')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'at_capacity' 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              At Capacity
            </button>

            {/* Closed */}
            <button
              onClick={() => setActiveFilter('closed')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'closed' 
                  ? 'bg-red-200 text-red-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-800"></span>
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
              className={`bg-white rounded-xl shadow-sm overflow-hidden border-t-4 ${status.border}`}
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">{dept.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Head: {dept.headName}</p>
              </div>

              {/* Staff Info Card - Light Blue */}
              <div className="mx-4 mb-2">
                <div className="bg-sky-50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-200 flex items-center justify-center">
                      <FiInfo className="text-sky-600 text-xs" />
                    </div>
                    <p className="text-sm text-gray-700">
                      {dept.waitingTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-gray-400 text-sm">
                  <FiClock className="text-xs" />
                  <span>updated {dept.lastUpdated}</span>
                </div>
                <button 
                  onClick={() => handleViewQueue(dept.name)}
                  className="text-sky-600 text-sm font-medium hover:text-sky-700 flex items-center gap-1"
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
