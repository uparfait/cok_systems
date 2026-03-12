// Service Details Modal Component

import { FiX, FiCheckCircle, FiDownload, FiClock, FiArrowRightCircle, FiUserCheck } from "react-icons/fi";

interface ServiceStatusVisitor {
  id: string;
  requestId: string;
  fullName: string;
  initials: string;
  contact: string;
  service: string;
  status: 'Pending' | 'In-Progress' | 'Completed' | 'Transferred';
  assignedTo: string;
  assignedToInitials?: string;
}

interface ServiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: ServiceStatusVisitor | null;
}

// Status badge helper
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Pending':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: FiClock,
        label: 'Pending'
      };
    case 'In-Progress':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: FiArrowRightCircle,
        label: 'In Progress'
      };
    case 'Completed':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: FiCheckCircle,
        label: 'Completed'
      };
    case 'Transferred':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: FiUserCheck,
        label: 'Transferred'
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        icon: FiClock,
        label: status
      };
  }
};

const ServiceDetailsModal: React.FC<ServiceDetailsModalProps> = ({ isOpen, onClose, visitor }) => {
  if (!isOpen || !visitor) return null;
  
  const statusBadge = getStatusBadge(visitor.status);
  const StatusIcon = statusBadge.icon;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.35)] backdrop-blur-sm" />
        
        {/* Modal Content */}
        <div 
          className="relative bg-white rounded-[20px] shadow-[0px_20px_60px_rgba(0,0,0,0.25)] w-full max-w-[900px] overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div>
              <h3 className="text-[22px] font-bold text-[#1E293B]">Service Completion Details</h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Status Badge - Dynamic based on visitor status */}
              <div className={`flex items-center gap-2 px-4 py-1.5 ${statusBadge.bg} rounded-full`}>
                <StatusIcon className={`w-4 h-4 ${statusBadge.text}`} />
                <span className={`text-sm font-semibold ${statusBadge.text}`}>{statusBadge.label}</span>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Timestamp */}
          <div className="px-8 pt-4">
            <p className="text-xs text-[#94A3B8] text-right">Completion Timestamp: Feb 26, 2026 at 10:45 AM</p>
          </div>

          {/* Modal Body - Two Column Layout */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-8">
              {/* LEFT SIDE - Visitor Information */}
              <div>
                <h4 className="text-sm font-semibold text-[#475569] uppercase tracking-wider mb-4">Visitor Information</h4>
                <div className="h-px bg-gray-200 mb-4"></div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Visitor Name</p>
                    <p className="text-sm font-semibold text-gray-800">{visitor.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Visitor ID</p>
                    <p className="text-sm font-semibold text-gray-800">1199080002234567</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Contact</p>
                    <p className="text-sm font-semibold text-gray-800">+250 788 123 456</p>
                    <p className="text-sm font-semibold text-gray-800">marieishimwe@email.com</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Original Request Description</p>
                    <div className="bg-[#F8FAFC] rounded-[12px] p-4">
                      <p className="text-sm text-[#475569]">Request for land title change and verification of property documents.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE - Service Context */}
              <div>
                <h4 className="text-sm font-semibold text-[#475569] uppercase tracking-wider mb-4">Service Context</h4>
                <div className="h-px bg-gray-200 mb-4"></div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Department</p>
                    <p className="text-sm font-semibold text-gray-800">LAND</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Service Type</p>
                    <p className="text-sm font-semibold text-gray-800">{visitor.service}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Assigned To</p>
                    <p className="text-sm font-semibold text-gray-800">{visitor.assignedTo}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Provider Note Card */}
            <div className="mt-8 p-6 bg-[#F0F9FF] border border-[#BAE6FD] rounded-[16px]">
              <h4 className="text-[16px] font-semibold text-gray-800 mb-3">Service Provider Note</h4>
              <p className="text-sm text-[#334155] leading-relaxed">
                The visitor's documents have been reviewed and verified. All required information has been provided. 
                The application has been processed and approved. The new land title certificate is ready for pickup.
              </p>
              <div className="mt-4">
                <span className="inline-flex px-3 py-1 bg-[#DBEAFE] text-[#1D4ED8] rounded-full text-xs font-semibold">
                  Information Provided
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-8 py-6 border-t border-gray-100 bg-gray-50 sticky bottom-0">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 border border-[#CBD5E1] bg-white rounded-[10px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#0284C7] rounded-[10px] text-white hover:bg-[#0369A1] transition-colors">
              <FiDownload className="w-4 h-4" />
              Download Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsModal;
