// Service Details Modal Component

import { FiX, FiCheckCircle, FiDownload, FiClock, FiArrowRightCircle, FiUserCheck } from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

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
        bg: 'bg-[rgba(243,156,18,0.12)]',
        text: 'text-[#F39C12]',
        icon: FiClock,
        label: 'Pending'
      };
    case 'In-Progress':
      return {
        bg: 'bg-[rgba(76,175,80,0.12)]',
        text: 'text-[#388E3C]',
        icon: FiArrowRightCircle,
        label: 'In Progress'
      };
    case 'Completed':
      return {
        bg: 'bg-[#F7F9FB]',
        text: 'text-[#555555]',
        icon: FiCheckCircle,
        label: 'Completed'
      };
    case 'Transferred':
      return {
        bg: 'bg-[rgba(41,128,185,0.1)]',
        text: 'text-[#2980B9]',
        icon: FiUserCheck,
        label: 'Transferred'
      };
    default:
      return {
        bg: 'bg-[#F7F9FB]',
        text: 'text-[#555555]',
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
        <div className="fixed inset-0 bg-black/40" />

        {/* Modal Content */}
        <div
          className="relative bg-white w-full max-w-[900px] overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto"
          style={{ borderRadius: 0, boxShadow: CARD_SHADOW }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b sticky top-0 bg-white z-10" style={{ borderColor: BORDER }}>
            <div>
              <h3 className="text-[22px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Completion Details</h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Status Badge - Dynamic based on visitor status */}
              <div className={`flex items-center gap-2 px-4 py-1.5 ${statusBadge.bg}`} style={{ borderRadius: 0 }}>
                <StatusIcon className={`w-4 h-4 ${statusBadge.text}`} />
                <span className={`text-sm font-semibold ${statusBadge.text}`} style={{ fontFamily: fontHeading }}>{statusBadge.label}</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 transition-colors"
                style={{ borderRadius: 0 }}
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Timestamp */}
          <div className="px-8 pt-4">
            <p className="text-xs text-[#9E9E9E] text-right">Completion Timestamp: Feb 26, 2026 at 10:45 AM</p>
          </div>

          {/* Modal Body - Two Column Layout */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-8">
              {/* LEFT SIDE - Visitor Information */}
              <div>
                <h4 className="mb-4" style={labelStyle}>Visitor Information</h4>
                <div className="h-px bg-[#E0E0E0] mb-4"></div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Visitor Name</p>
                    <p className="text-sm font-semibold text-[#333333]">{visitor.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Visitor ID</p>
                    <p className="text-sm font-semibold text-[#333333]">1199080002234567</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Contact</p>
                    <p className="text-sm font-semibold text-[#333333]">+250 788 123 456</p>
                    <p className="text-sm font-semibold text-[#333333]">marieishimwe@email.com</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Original Request Description</p>
                    <div className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                      <p className="text-sm text-[#555555]">Request for land title change and verification of property documents.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE - Service Context */}
              <div>
                <h4 className="mb-4" style={labelStyle}>Service Context</h4>
                <div className="h-px bg-[#E0E0E0] mb-4"></div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Department</p>
                    <p className="text-sm font-semibold text-[#333333]">LAND</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Service Type</p>
                    <p className="text-sm font-semibold text-[#333333]">{visitor.service}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E] mb-1">Assigned To</p>
                    <p className="text-sm font-semibold text-[#333333]">{visitor.assignedTo}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Provider Note Card */}
            <div className="mt-8 p-6 bg-[rgba(5,109,170,0.08)]" style={{ borderRadius: 0 }}>
              <h4 className="text-[16px] font-bold mb-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Provider Note</h4>
              <p className="text-sm text-[#555555] leading-relaxed">
                The visitor's documents have been reviewed and verified. All required information has been provided.
                The application has been processed and approved. The new land title certificate is ready for pickup.
              </p>
              <div className="mt-4">
                <span className="inline-flex px-3 py-1 bg-[rgba(5,109,170,0.12)] text-[#056daa] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: fontHeading, borderRadius: 0 }}>
                  Information Provided
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-8 py-6 border-t sticky bottom-0" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
            <button
              onClick={onClose}
              className="px-5 py-2.5 transition-colors hover:bg-[rgba(5,109,170,0.08)]"
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${PRIMARY}`,
                color: PRIMARY,
                borderRadius: 0,
                fontFamily: fontHeading,
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
            >
              Close
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 transition-colors"
              style={{
                backgroundColor: PRIMARY,
                color: WHITE,
                borderRadius: 0,
                fontFamily: fontHeading,
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
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
