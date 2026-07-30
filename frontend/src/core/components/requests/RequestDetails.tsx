import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const RequestDetails: React.FC<{
  request: RequestDoc;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ request, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [localStatus, setLocalStatus] = useState(request.status || 'Pending');

  useEffect(() => {
    setLocalStatus(request.status || 'Pending');
  }, [request.status]);

  const handleStatusChange = async (newStatus: 'Pending' | 'Inprogress' | 'Completed' | 'Archived') => {
    if (!request._id || newStatus === request.status) return;
    if (newStatus === 'Archived') {
      setShowArchiveModal(true);
      return;
    }
    setLoading(true);
    try {
      await requestService.update(request._id, { status: newStatus });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!request._id || !archiveReason.trim()) return;
    setLoading(true);
    try {
      await requestService.archive(request._id, archiveReason);
      onUpdate();
      setShowArchiveModal(false);
      onClose();
    } catch (error) {
      console.error('Failed to archive request:', error);
    } finally {
      setLoading(false);
    }
  };

  const rows = [
    { label: 'Redaction Date', value: request.redaction_date ? new Date(request.redaction_date).toLocaleDateString('en-GB') : '-' },
    { label: 'Reference Number', value: request.reference_number || '-' },
    { label: 'Reception Date', value: request.reception_date ? new Date(request.reception_date).toLocaleDateString('en-GB') : '-' },
    {
      label: 'Sender',
      value: request.sender ? (
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{request.sender.name || '-'}</p>
          {request.sender.email && <p className="text-xs text-gray-500">{request.sender.email}</p>}
          {request.sender.telephone && <p className="text-xs text-gray-500">{request.sender.telephone}</p>}
        </div>
      ) : '-'
    },
    { label: 'Recipient', value: request.recipient || 'COK' },
    { label: 'Subject', value: request.subject || '-' },
    { label: 'Orientation', value: request.orientation || '-' },
    { label: 'Remarks', value: request.remarks || '-' },
    {
      label: 'Assigned By',
      value: (
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{request.assigned_by?.name || '-'}</p>
          <p className="text-xs text-gray-500">{request.assigned_by?.title || ''}</p>
          {request.assigned_by?.tel && <p className="text-xs text-gray-500">{request.assigned_by.tel}</p>}
        </div>
      )
    },
    {
      label: 'Status',
      value: (
        <select
          value={localStatus}
          onChange={(e) => handleStatusChange(e.target.value as 'Pending' | 'Inprogress' | 'Completed' | 'Archived')}
          className="cok-auth-input w-full py-2.5 px-3 text-sm"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <option value="Pending">Pending</option>
          <option value="Inprogress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Archived">Archived</option>
        </select>
      )
    },
  ];

  if (request.status === 'Archived') {
    rows.push({ label: 'Archive Reason', value: request.archive_reason || '-' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4"
          style={{ backgroundColor: '#056daa', borderRadius: 0 }}
        >
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Request Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderRadius: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#F7F9FB' }}>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ width: '35%' }}>
                    Field
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {row.label}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#333333' }}>
                      {typeof row.value === 'string' ? (
                        <span className={row.value === '-' ? 'text-gray-400' : ''}>{row.value}</span>
                      ) : (
                        row.value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showArchiveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white w-full max-w-md p-6"
            style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>
              Archive Request
            </h3>
            <p className="text-sm text-gray-600 mb-4">Please provide a reason for archiving this request.</p>
            <textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="Enter archive reason"
              rows={4}
              className="cok-auth-input w-full mb-4"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
                style={{ borderRadius: 0, color: '#333333' }}
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={loading || !archiveReason.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#E53935', borderRadius: 0 }}
              >
                {loading ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetails;
