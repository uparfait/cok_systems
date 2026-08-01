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
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressReason, setProgressReason] = useState('');
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
    if (newStatus === 'Inprogress') {
      setShowProgressModal(true);
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

  const handleProgress = async () => {
    if (!request._id || !progressReason.trim()) return;
    setLoading(true);
    try {
      await requestService.update(request._id, { status: 'Inprogress' });
      onUpdate();
      setShowProgressModal(false);
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
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
          <option value="Overdue">Overdue</option>
        </select>
      )
    },
  ];

  if (request.status === 'Archived') {
    rows.push({ label: 'Archive Reason', value: request.archive_reason || '-' });
  }

  if (request.status_reason) {
    rows.push({ label: 'Status Reason', value: request.status_reason });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary"
          style={{ borderRadius: 0 }}
        >
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Request Details
          </h2>
          <button
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <FiX className="w-4 h-4" />
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

        <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
          <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
            Close
          </button>
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
                className="cok-btn-outlined flex-1"
                style={{ padding: '0.7rem 1.2rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={loading || !archiveReason.trim()}
                className="cok-btn-primary flex-1 disabled:opacity-50"
                style={{ padding: '0.7rem 1.2rem', backgroundColor: '#E53935' }}
              >
                {loading ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white w-full max-w-md p-6"
            style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>
              Mark as In Progress
            </h3>
            <p className="text-sm text-gray-600 mb-4">Please provide a reason for marking this request as in progress.</p>
            <textarea
              value={progressReason}
              onChange={(e) => setProgressReason(e.target.value)}
              placeholder="Enter reason"
              rows={4}
              className="cok-auth-input w-full mb-4"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowProgressModal(false)}
                className="cok-btn-outlined flex-1"
                style={{ padding: '0.7rem 1.2rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleProgress}
                disabled={loading || !progressReason.trim()}
                className="cok-btn-primary flex-1 disabled:opacity-50"
                style={{ padding: '0.7rem 1.2rem', backgroundColor: '#F39C12' }}
              >
                {loading ? 'Saving...' : 'Mark In Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetails;
