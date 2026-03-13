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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FiClock className="text-gray-500" />
          <h3 className="font-medium text-gray-800">Transfer History</h3>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {transfers.length}
          </span>
        </div>
        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
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
                      <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    
                    {/* Icon */}
                    <div className="relative z-10 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FiArrowRight className="text-blue-600" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-6">
                      {/* Transfer Info */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {transfer.fromDepartment}
                            <FiArrowRight className="inline mx-2 text-gray-400" />
                            {transfer.toDepartment}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
                        <span className="text-xs text-gray-400">
                          {formatDateTime(transfer.transferredAt)}
                        </span>
                      </div>

                      {/* Reason */}
                      {transfer.reason && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Reason
                          </span>
                          <p className="text-sm text-gray-700 mt-1">{transfer.reason}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {transfer.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                            <FiMessageSquare className="w-3 h-3" />
                            Notes
                          </span>
                          <p className="text-sm text-gray-700 mt-1">{transfer.notes}</p>
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
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
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
      <p className="text-sm text-gray-500 italic">No transfers</p>
    );
  }

  const latestTransfer = transfers[0];

  return (
    <div className="flex items-center gap-2 text-sm">
      <FiMapPin className="text-gray-400" />
      <span className="text-gray-600">
        {latestTransfer.fromDepartment}
        <FiArrowRight className="inline mx-1 text-gray-400" />
        {latestTransfer.toDepartment}
      </span>
      <span className="text-xs text-gray-400">
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
