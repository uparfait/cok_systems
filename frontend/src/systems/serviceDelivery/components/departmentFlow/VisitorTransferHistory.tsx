// VisitorTransferHistory Component - Visitor transfer log
// Shows history of visitor department transfers

import React, { useState, useEffect } from 'react';
import {
  FiClock,
  FiMapPin,
  FiUser,
  FiArrowRight,
  FiChevronDown,
  FiChevronUp,
  FiCalendar,
  FiMessageSquare
} from 'react-icons/fi';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface TransferRecord {
  _id: string;
  fromDepartment: string;
  toDepartment: string;
  transferredBy: string;
  transferredAt: string;
  reason?: string;
  notes?: string;
}

interface VisitorTransferHistoryProps {
  visitorId?: string;
  transfers?: TransferRecord[];
  onLoadMore?: () => void;
  isLoading?: boolean;
}

// Mock transfer data for demo
const mockTransfers: TransferRecord[] = [
  {
    _id: '1',
    fromDepartment: 'Reception',
    toDepartment: 'Operations',
    transferredBy: 'Alice Uwase',
    transferredAt: new Date(Date.now() - 30 * 60000).toISOString(),
    reason: 'Initial assignment',
    notes: 'Visitor requires parking assistance',
  },
  {
    _id: '2',
    fromDepartment: 'Operations',
    toDepartment: 'Finance',
    transferredBy: 'Bob Mugisha',
    transferredAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    reason: 'Service escalation',
    notes: 'Tax inquiry requires finance department',
  },
  {
    _id: '3',
    fromDepartment: 'Finance',
    toDepartment: 'Legal',
    transferredBy: 'Claire Mukamana',
    transferredAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    reason: 'Complex case',
    notes: 'Legal consultation needed',
  },
];

const VisitorTransferHistory: React.FC<VisitorTransferHistoryProps> = ({
  visitorId,
  transfers: propTransfers,
  onLoadMore,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [transfers, setTransfers] = useState<TransferRecord[]>(propTransfers || mockTransfers);

  // Update transfers when props change
  useEffect(() => {
    if (propTransfers) {
      setTransfers(propTransfers);
    }
  }, [propTransfers]);

  // Format date/time
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get time ago
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return formatDateTime(dateStr);
  };

  return (
    <div className="bg-white overflow-hidden" style={{ borderRadius: 0, boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between cursor-pointer"
        style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: BORDER }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FiClock className="text-[#9E9E9E]" />
          <h3 className="font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Transfer History</h3>
          <span className="text-xs text-[#555555] bg-[#E0E0E0] px-2 py-0.5" style={{ borderRadius: 0 }}>
            {transfers.length}
          </span>
        </div>
        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-[#9E9E9E]">
              <FiMapPin className="text-4xl mx-auto mb-2 opacity-50" />
              <p>No transfer history</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline */}
              <div className="space-y-6">
                {transfers.map((transfer, index) => (
                  <div key={transfer._id} className="relative flex gap-4">
                    {/* Timeline connector */}
                    {index < transfers.length - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-[#E0E0E0]" />
                    )}

                    {/* Icon */}
                    <div className="relative z-10 w-8 h-8 bg-[rgba(5,109,170,0.1)] rounded-full flex items-center justify-center flex-shrink-0">
                      <FiArrowRight className="text-[#056daa]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      {/* Transfer Info */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-[#333333]">
                            {transfer.fromDepartment}
                            <FiArrowRight className="inline mx-2 text-[#9E9E9E]" />
                            {transfer.toDepartment}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#9E9E9E]">
                            <span className="flex items-center gap-1">
                              <FiUser className="w-3 h-3" />
                              {transfer.transferredBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <FiClock className="w-3 h-3" />
                              {getTimeAgo(transfer.transferredAt)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-[#9E9E9E]">
                          {formatDateTime(transfer.transferredAt)}
                        </span>
                      </div>

                      {/* Reason */}
                      {transfer.reason && (
                        <div className="mt-2">
                          <span
                            className="text-xs"
                            style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}
                          >
                            Reason
                          </span>
                          <p className="text-sm text-[#555555] mt-1">{transfer.reason}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {transfer.notes && (
                        <div className="mt-2 p-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}
                          >
                            <FiMessageSquare className="w-3 h-3" />
                            Notes
                          </span>
                          <p className="text-sm text-[#555555] mt-1">{transfer.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load More */}
          {onLoadMore && transfers.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
              <button
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full text-center transition-colors disabled:opacity-50"
                style={{ color: PRIMARY, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', borderRadius: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
              >
                {isLoading ? 'Loading...' : 'View All History'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Compact version for inline use in visitor detail
export const CompactTransferHistory: React.FC<{ transfers: TransferRecord[] }> = ({ transfers }) => {
  if (transfers.length === 0) {
    return (
      <p className="text-sm text-[#9E9E9E] italic">No transfers</p>
    );
  }

  const latestTransfer = transfers[0];

  return (
    <div className="flex items-center gap-2 text-sm">
      <FiMapPin className="text-[#9E9E9E]" />
      <span className="text-[#555555]">
        {latestTransfer.fromDepartment}
        <FiArrowRight className="inline mx-1 text-[#9E9E9E]" />
        {latestTransfer.toDepartment}
      </span>
      <span className="text-xs text-[#9E9E9E]">
        ({getTimeAgo(latestTransfer.transferredAt)})
      </span>
    </div>
  );
};

// Helper function for time ago
const getTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default VisitorTransferHistory;
