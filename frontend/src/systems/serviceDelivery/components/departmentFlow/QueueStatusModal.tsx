// QueueStatusModal Component - Shows departmental queue status

import { useState } from "react";
import {
  FiX, FiRefreshCw, FiClock, FiUsers, FiCheckCircle,
  FiChevronLeft, FiChevronRight, FiPrinter, FiArrowUp
} from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

// Queue visitor avatar colors based on status
const getAvatarColorByStatus = (status: string) => {
  switch (status) {
    case 'in_progress':
      return 'bg-[#056daa]';
    case 'next':
      return 'bg-[#E74C3C]';
    case 'waiting':
      return 'bg-[#2980B9]';
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
    // Fixed overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - plain, no blur */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: WHITE }}>
          <div>
            <h2 className="text-xl" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Departmental Queue Status</h2>
            <div className="flex items-center gap-2 mt-1">
              <FiUsers style={{ color: PRIMARY }} />
              <span style={{ color: '#555555' }}>{departmentName} Live Queue</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 transition-colors"
            >
              <FiRefreshCw className={isRefreshing ? 'animate-spin' : ''} style={{ color: PRIMARY }} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 transition-colors"
            >
              <FiX className="text-xl" style={{ color: NEUTRAL_DARK }} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="px-6 py-4 flex gap-4 flex-shrink-0" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          {/* Est. Wait Time Card */}
          <div className="flex-1 p-4" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}>
                <FiClock style={{ color: PRIMARY }} />
              </div>
              <span className="text-sm text-gray-600">Est. Wait Time</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>12 MINS</span>
              <span className="text-sm flex items-center" style={{ color: SUCCESS }}>
                <FiArrowUp className="rotate-180" />
                -2m
              </span>
            </div>
          </div>

          {/* People Waiting Card */}
          <div className="flex-1 p-4" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}>
                <FiUsers style={{ color: PRIMARY }} />
              </div>
              <span className="text-sm text-gray-600">People Waiting</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>8</span>
              <span className="text-sm text-gray-500">visitors</span>
            </div>
          </div>

          {/* Completed Today Card */}
          <div className="flex-1 p-4" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}>
                <FiCheckCircle style={{ color: PRIMARY }} />
              </div>
              <span className="text-sm text-gray-600">Completed Today</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>42</span>
              <span className="text-sm" style={{ color: SUCCESS }}>+12%</span>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>POS</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>VISITOR NAME</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>SERVICE TYPE</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>WAIT TIME</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {QUEUE_DATA.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>#{visitor.pos}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${getAvatarColorByStatus(visitor.status)} flex items-center justify-center text-white text-xs font-medium`}>
                        {visitor.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.name}</p>
                        <p className="text-xs text-gray-500">ID: {visitor.nationalId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: '#555555' }}>{visitor.serviceType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: '#555555' }}>{visitor.waitTime}</span>
                  </td>
                  <td className="px-4 py-3">
                    {visitor.status === 'in_progress' && (
                      <span className="px-3 py-1 bg-[rgba(76,175,80,0.12)] text-[#388E3C] text-xs font-medium">
                        In Progress
                      </span>
                    )}
                    {visitor.status === 'next' && (
                      <span className="px-3 py-1 bg-[rgba(231,76,60,0.12)] text-[#E74C3C] text-xs font-medium">
                        Next
                      </span>
                    )}
                    {visitor.status === 'waiting' && (
                      <span className="px-3 py-1 bg-[rgba(41,128,185,0.12)] text-[#2980B9] text-xs font-medium">
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
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
          <p className="text-sm text-gray-500">
            Showing 1 to 5 of {totalResults} results
          </p>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, borderRadius: 0, color: '#555555' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className="w-8 h-8 flex items-center justify-center text-sm font-medium transition-colors"
                style={currentPage === page
                  ? { backgroundColor: PRIMARY, color: WHITE, borderRadius: 0 }
                  : { border: `1px solid ${BORDER}`, color: '#555555', borderRadius: 0 }}
              >
                {page}
              </button>
            ))}
            <button
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, borderRadius: 0, color: '#555555' }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={onClose}
            className="px-4 py-2 transition-colors"
            style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 flex items-center gap-2 transition-colors"
            style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
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
