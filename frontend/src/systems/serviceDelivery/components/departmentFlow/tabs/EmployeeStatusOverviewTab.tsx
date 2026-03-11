// Employee Status Overview Tab Component

import { FiSearch, FiFilter } from "react-icons/fi";

// Employee card data
const employeeCards = [
  { name: 'Jane Doe', role: 'Senior Officer', status: 'Online', statusBg: '#e6f4ea', statusColor: '#34a853', initials: 'JD', dotColor: '#34a853', time: '5m ago', section: 'WORKLOAD', left: 'Processing Requests', right: '3 Active', rightColor: '#1a73e8' },
  { name: 'Robert Mugisha', role: 'Tax Specialist', status: 'In a Service', statusBg: '#e8f0fe', statusColor: '#1a73e8', initials: 'RM', dotColor: '#1a73e8', time: 'Now', section: 'QUEUE', left: 'Visitors Waiting', right: '2 People', rightColor: '#1a73e8' },
  { name: 'Sarah Keza', role: 'Permit Officer', status: 'Away', statusBg: '#fff3e0', statusColor: '#ff9800', initials: 'SK', dotColor: '#ff9800', time: '15m ago', section: 'NEXT AVAILABLE', left: 'Expected Return', right: '14:30 PM', rightColor: '#333' },
  { name: 'Alice Uwase', role: 'Customer Support', status: 'In a Service', statusBg: '#e8f0fe', statusColor: '#1a73e8', initials: 'AU', dotColor: '#1a73e8', time: '45m', section: 'QUEUE', left: 'Visitors Waiting', right: '5 People', rightColor: '#1a73e8' },
  { name: 'Claire Uwamahoro', role: 'IT Support', status: 'Online', statusBg: '#e6f4ea', statusColor: '#34a853', initials: 'CU', dotColor: '#34a853', time: '10m ago', section: 'TICKETS', left: 'Open Tickets', right: '1 Urgent', rightColor: '#ea4335' },
  { name: 'David Karekezi', role: 'Site Inspector', status: 'On Site Visit', statusBg: '#fffde7', statusColor: '#f9a825', initials: 'DK', dotColor: '#f9a825', time: '3h ago', section: 'LOCATION', left: 'District B', right: 'Returning 4PM', rightColor: '#333' },
  { name: 'John Ndayisaba', role: 'Urban Planner', status: 'Offline', statusBg: '#f5f5f5', statusColor: '#888888', initials: 'JN', dotColor: '#888888', time: '2h ago', section: 'STATUS', left: 'Last Active', right: '11:00 AM', rightColor: '#333' },
];

const EmployeeStatusOverviewTab = () => {
  return (
    <div className="pb-6">
      {/* Search & Filter Bar */}
      <div className="bg-white mx-6 mt-4 rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        {/* Search Input */}
        <div className="relative flex-1" style={{ maxWidth: '380px' }}>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee by name or ID..."
            className="w-full pl-10 pr-4 py-2 bg-transparent border-0 rounded-lg focus:outline-none text-sm"
            style={{ color: '#666' }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          <select className="px-4 py-2 bg-white border rounded-lg text-sm" style={{ borderColor: '#e0e0e0', color: '#333' }}>
            <option>All Statuses</option>
            <option>Online</option>
            <option>Away</option>
            <option>In a Service</option>
            <option>On Site Visit</option>
            <option>Offline</option>
          </select>

          {/* More Filters Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm" style={{ borderColor: '#e0e0e0', color: '#333' }}>
            <FiFilter className="w-4 h-4" />
            More Filters
          </button>

          {/* Add Staff Button */}
          <button className="flex items-center gap-1 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium">
            + Add Staff
          </button>
        </div>
      </div>

      {/* Employee Cards Grid - 4 columns */}
      <div className="grid grid-cols-4 gap-4 px-6 mt-4">
        {employeeCards.map((emp, index) => (
          <div key={index} className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">{emp.initials}</div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: emp.dotColor }}></div>
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#1a2744' }}>{emp.name}</p>
                  <p className="text-xs" style={{ color: '#888' }}>{emp.role}</p>
                </div>
              </div>
              <button className="text-gray-500 hover:text-gray-700 font-bold text-lg">⋮</button>
            </div>
            <div className="mt-3">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{ background: emp.statusBg, color: emp.statusColor, border: `1px solid ${emp.statusColor}` }}>{emp.status}</span>
              <p className="text-xs mt-1" style={{ color: '#aaa' }}>• {emp.time}</p>
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
              <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#666', letterSpacing: '0.5px' }}>{emp.section}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm" style={{ color: '#333' }}>{emp.left}</span>
                <span className="text-sm font-bold" style={{ color: emp.rightColor }}>{emp.right}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 mt-4" style={{ borderTop: '1px solid #e0e0e0' }}>
        <p className="text-sm" style={{ color: '#888' }}>
          Showing <span className="font-bold text-gray-800">1</span> to <span className="font-bold text-gray-800">8</span> of <span className="font-bold text-gray-800">8</span> employees
        </p>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm rounded-lg" style={{ color: '#bbb', border: '1px solid #e0e0e0' }} disabled>
            Previous
          </button>
          <button className="px-4 py-2 text-sm rounded-lg" style={{ color: '#333', border: '1px solid #e0e0e0', background: 'white' }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeStatusOverviewTab;
