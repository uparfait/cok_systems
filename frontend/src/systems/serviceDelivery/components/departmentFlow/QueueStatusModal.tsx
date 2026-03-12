// QueueStatusModal Component - Shows departmental queue status

import { useState } from "react";
import { 
  FiX, FiRefreshCw, FiClock, FiUsers, FiCheckCircle,
  FiChevronLeft, FiChevronRight, FiPrinter, FiArrowUp
} from "react-icons/fi";

// Queue visitor avatar colors based on status
const getAvatarColorByStatus = (status: string) => {
  switch (status) {
    case 'in_progress':
      return 'bg-blue-500';
    case 'next':
      return 'bg-red-500';
    case 'waiting':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
};

// Mock queue data
interface QueueVisitor {
  id: string;
  pos: number;
  name: string;
  initials: string;
  nationalId: string;
  serviceType: string;
  waitTime: string;
  status: 'in_progress' | 'next' | 'waiting';
}

const QUEUE_DATA: QueueVisitor[] = [
  { id: '1', pos: 1, name: 'Jean Pierre', initials: 'JP', nationalId: '88293', serviceType: 'Land Transfer', waitTime: 'In session', status: 'in_progress' },
  { id: '2', pos: 2, name: 'Marie Claire', initials: 'MC', nationalId: '44210', serviceType: 'Title Deed', waitTime: '-5mins', status: 'next' },
  { id: '3', pos: 3, name: 'Emmanuel N.', initials: 'EN', nationalId: '77432', serviceType: 'Zoning Permit', waitTime: '12mins', status: 'waiting' },
  { id: '4', pos: 4, name: 'Alice M.', initials: 'AM', nationalId: '66543', serviceType: 'Land Transfer', waitTime: '25mins', status: 'waiting' },
  { id: '5', pos: 5, name: 'David K.', initials: 'DK', nationalId: '55432', serviceType: 'Construction', waitTime: '40mins', status: 'waiting' },
];

interface QueueStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
}

const QueueStatusModal: React.FC<QueueStatusModalProps> = ({
  isOpen,
  onClose,
  departmentName,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalPages = 3;
  const totalResults = 12;
  const itemsPerPage = 5;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    // Fixed overlay with backdrop blur effect
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-black">Departmental Queue Status</h2>
            <div className="flex items-center gap-2 mt-1">
              <FiUsers className="text-blue-300" />
              <span className="text-black-100">{departmentName} Live Queue</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FiRefreshCw className={`text-white ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FiX className="text-white text-xl" />
            </button>
          </div>
        </div>

        {/* KPI Cards - Sky Blue Background */}
        <div className="bg-sky-50 px-6 py-4 flex gap-4 flex-shrink-0">
          {/* Est. Wait Time Card */}
          <div className="flex-1 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                <FiClock className="text-blue-600" />
              </div>
              <span className="text-sm text-gray-600">Est. Wait Time</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-800">12 MINS</span>
              <span className="text-sm text-green-600 flex items-center">
                <FiArrowUp className="rotate-180" />
                -2m
              </span>
            </div>
          </div>

          {/* People Waiting Card */}
          <div className="flex-1 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                <FiUsers className="text-blue-600" />
              </div>
              <span className="text-sm text-gray-600">People Waiting</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-gray-800">8</span>
              <span className="text-sm text-gray-500">visitors</span>
            </div>
          </div>

          {/* Completed Today Card */}
          <div className="flex-1 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                <FiCheckCircle className="text-blue-600" />
              </div>
              <span className="text-sm text-gray-600">Completed Today</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-800">42</span>
              <span className="text-sm text-green-600">+12%</span>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">POS</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">VISITOR NAME</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">SERVICE TYPE</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">WAIT TIME</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {QUEUE_DATA.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-800">#{visitor.pos}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${getAvatarColorByStatus(visitor.status)} flex items-center justify-center text-white text-xs font-medium`}>
                        {visitor.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{visitor.name}</p>
                        <p className="text-xs text-gray-500">ID: {visitor.nationalId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{visitor.serviceType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{visitor.waitTime}</span>
                  </td>
                  <td className="px-4 py-3">
                    {visitor.status === 'in_progress' && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        In Progress
                      </span>
                    )}
                    {visitor.status === 'next' && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        Next
                      </span>
                    )}
                    {visitor.status === 'waiting' && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        Waiting
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-500">
            Showing 1 to 5 of {totalResults} results
          </p>
          <div className="flex items-center gap-2">
            <button 
              className="w-8 h-8 flex items-center justify-center text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button 
              className="w-8 h-8 flex items-center justify-center text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FiPrinter className="w-4 h-4" />
            Print Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueStatusModal;
