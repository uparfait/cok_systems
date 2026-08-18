import React from 'react';
import { FiTrash2, FiAlertTriangle, FiMail, FiCheckCircle } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const DANGER = '#E74C3C';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const WHITE = '#FFFFFF';
const GRAY_DISABLED = '#9E9E9E';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const fontHeading = "'Montserrat', sans-serif";

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const AVAILABLE_COLLECTIONS = [
  { value: 'announcements', label: 'Announcements' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'audits', label: 'Audits' },
  { value: 'boards', label: 'Boards' },
  { value: 'chatmessages', label: 'Chat Messages' },
  { value: 'defaultroles', label: 'Default Roles' },
  { value: 'emergencycars', label: 'Emergency Cars' },
  { value: 'emergencycarhistories', label: 'Emergency Car Histories' },
  { value: 'eventactions', label: 'Event Actions' },
  { value: 'feedbacks', label: 'Feedbacks' },
  { value: 'flaggedvehicles', label: 'Flagged Vehicles' },
  { value: 'lists', label: 'Lists' },
  { value: 'liveevents', label: 'Live Events' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'outgoings', label: 'Outgoings' },
  { value: 'parkingrecords', label: 'Parking Records' },
  { value: 'parkingslots', label: 'Parking Slots' },
  { value: 'pastevents', label: 'Past Events' },
  { value: 'postmeetings', label: 'Post Meetings' },
  { value: 'recurringevents', label: 'Recurring Events' },
  { value: 'requests', label: 'Requests' },
  { value: 'servicedeliveries', label: 'Service Deliveries' },
  { value: 'servicetrackings', label: 'Service Trackings' },
  { value: 'staffcars', label: 'Staff Cars' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'unservicedfeedbacks', label: 'Unserviced Feedbacks' },
  { value: 'notificationsubscriptions', label: 'Notification Subscriptions' },
];

export type DeleteStep = 'idle' | 'select' | 'confirm' | 'token' | 'processing' | 'done';

interface DataManagementSectionProps {
  deleteStep: DeleteStep;
  selectedCollections: string[];
  deletePeriod: string;
  deleteFrom: string;
  deleteTo: string;
  deleteReason: string;
  requestKey: string;
  deleteToken: string;
  deleteResults: any[];
  showDeleteWarnings: boolean;
  loading: boolean;
  onToggleCollection: (value: string) => void;
  onDeletePeriodChange: (value: string) => void;
  onDeleteFromChange: (value: string) => void;
  onDeleteToChange: (value: string) => void;
  onDeleteReasonChange: (value: string) => void;
  onDeleteTokenChange: (value: string) => void;
  onStartDelete: () => void;
  onConfirmWarnings: () => void;
  onConfirmDelete: () => void;
  onCancelWarnings: () => void;
  onResetDeleteFlow: () => void;
  onShowWarningsChange: (show: boolean) => void;
  showWarning: (message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const DataManagementSection: React.FC<DataManagementSectionProps> = ({
  deleteStep,
  selectedCollections,
  deletePeriod,
  deleteFrom,
  deleteTo,
  deleteReason,
  requestKey,
  deleteToken,
  deleteResults,
  showDeleteWarnings,
  loading,
  onToggleCollection,
  onDeletePeriodChange,
  onDeleteFromChange,
  onDeleteToChange,
  onDeleteReasonChange,
  onDeleteTokenChange,
  onStartDelete,
  onConfirmWarnings,
  onConfirmDelete,
  onCancelWarnings,
  onResetDeleteFlow,
  onShowWarningsChange,
  showWarning,
  showSuccess,
  showError,
}) => {
  const handleStartDelete = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (selectedCollections.length === 0) {
      showWarning('Please select at least one collection to delete');
      return;
    }
    onShowWarningsChange(true);
  };

  return (
    <div
      className="p-4 relative"
      style={{
        backgroundColor: WHITE,
        boxShadow: CARD_SHADOW,
        borderRadius: 0,
      }}
    >
      {loading && deleteStep !== 'processing' && deleteStep !== 'done' && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
          <SpiralLoader />
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5"
            style={{
              backgroundColor: 'rgba(231,76,60,0.08)',
              borderRadius: 0,
            }}
          >
            <FiTrash2 className="w-4 h-4" style={{ color: DANGER }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              Data Management
            </h3>
            <p className="text-xs" style={{ color: GRAY_DISABLED }}>
              Delete data by collection and time range
            </p>
          </div>
        </div>
      </div>

      {deleteStep === 'idle' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2" style={{ fontFamily: fontHeading }}>
              Select Collections to Delete
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 border border-[#E0E0E0]">
              {AVAILABLE_COLLECTIONS.map((col) => (
                <label
                  key={col.value}
                  className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(col.value)}
                    onChange={() => onToggleCollection(col.value)}
                    className="border-gray-300"
                  />
                  <span className="text-xs text-gray-700">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2" style={{ fontFamily: fontHeading }}>
              Time Range
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={deletePeriod}
                onChange={(e) => onDeletePeriodChange(e.target.value)}
                className="cok-auth-input w-full sm:w-auto"
                style={{ fontFamily: fontHeading }}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {deletePeriod === 'range' && (
                <>
                  <input
                    type="date"
                    value={deleteFrom}
                    onChange={(e) => onDeleteFromChange(e.target.value)}
                    className="cok-auth-input w-full sm:w-auto"
                    style={{ fontFamily: fontHeading }}
                  />
                  <input
                    type="date"
                    value={deleteTo}
                    onChange={(e) => onDeleteToChange(e.target.value)}
                    className="cok-auth-input w-full sm:w-auto"
                    style={{ fontFamily: fontHeading }}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2" style={{ fontFamily: fontHeading }}>
              Reason (Optional)
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => onDeleteReasonChange(e.target.value)}
              className="cok-auth-input w-full"
              rows={2}
              placeholder="Reason for deletion..."
              style={{ fontFamily: fontHeading }}
            />
          </div>

          <button
            type="button"
            onClick={handleStartDelete}
            disabled={selectedCollections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#E74C3C] text-white text-sm font-semibold uppercase hover:bg-[#C0392B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: fontHeading, letterSpacing: '1px' }}
          >
            <FiTrash2 className="w-4 h-4" />
            Request Data Deletion
          </button>
        </div>
      )}

      {deleteStep === 'token' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiMail className="w-5 h-5 text-yellow-600" />
              <h4 className="text-sm font-semibold text-yellow-800" style={{ fontFamily: fontHeading }}>
                Confirmation Token Sent
              </h4>
            </div>
            <p className="text-xs text-yellow-700">
              A 5-digit confirmation token has been sent to your email address. Please enter it below to proceed with the deletion.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2" style={{ fontFamily: fontHeading }}>
              Enter Confirmation Token
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteToken}
                onChange={(e) => onDeleteTokenChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="cok-auth-input flex-1"
                placeholder="12345"
                maxLength={5}
                style={{ fontFamily: fontHeading, letterSpacing: 8, textAlign: 'center' }}
              />
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleteToken.length !== 5}
                className="cok-btn-primary"
                style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
              >
                Confirm Delete
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetDeleteFlow}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Cancel and start over
          </button>
        </div>
      )}

      {deleteStep === 'processing' && (
        <div className="flex items-center justify-center py-8">
          <SpiralLoader />
        </div>
      )}

      {deleteStep === 'done' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiCheckCircle className="w-5 h-5 text-green-600" />
              <h4 className="text-sm font-semibold text-green-800" style={{ fontFamily: fontHeading }}>
                Deletion Complete
              </h4>
            </div>
            <p className="text-xs text-green-700">
              The selected data has been permanently deleted from the system.
            </p>
          </div>

          {deleteResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E0E0E0]" style={{ backgroundColor: 'rgba(5,109,170,0.06)' }}>
                    <th className="px-3 py-2 text-left font-semibold text-[#056daa] text-xs uppercase tracking-wider">Collection</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#056daa] text-xs uppercase tracking-wider">Deleted Records</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#056daa] text-xs uppercase tracking-wider">Freed Space</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {deleteResults.map((result, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-gray-900">{result.collection}</td>
                      <td className="px-3 py-2 text-gray-700">{(result.deletedCount || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-700">{result.formattedSizeFreed || '0 B'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={onResetDeleteFlow}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
          >
            Delete More Data
          </button>
        </div>
      )}

      {showDeleteWarnings && (
        <DeleteWarningModal
          selectedCollections={selectedCollections}
          deletePeriod={deletePeriod}
          deleteFrom={deleteFrom}
          deleteTo={deleteTo}
          onConfirm={onConfirmWarnings}
          onCancel={onCancelWarnings}
        />
      )}
    </div>
  );
};

interface DeleteWarningModalProps {
  selectedCollections: string[];
  deletePeriod: string;
  deleteFrom: string;
  deleteTo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteWarningModal: React.FC<DeleteWarningModalProps> = ({
  selectedCollections,
  deletePeriod,
  deleteFrom,
  deleteTo,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5 text-red-600" />
            Confirm Data Deletion
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-red-50 border border-red-200 p-4">
            <h4 className="text-sm font-semibold text-red-800 mb-2" style={{ fontFamily: fontHeading }}>
              Warning: This action cannot be undone
            </h4>
            <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
              <li>You are about to permanently delete data from <strong>{selectedCollections.length} collection(s)</strong></li>
              <li>The selected data will be removed for the time range: <strong>{deletePeriod === 'range' ? `${deleteFrom} to ${deleteTo}` : deletePeriod.replace('_', ' ')}</strong></li>
              <li>This operation is irreversible and cannot be recovered</li>
              <li>Related reports and analytics may be affected</li>
              <li>System audit logs will record this deletion</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2" style={{ fontFamily: fontHeading }}>
              Protected Collections
            </h4>
            <p className="text-xs text-yellow-700">
              The following collections are protected and will NOT be deleted: <strong>Users, Departments, Rooms</strong>
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2" style={{ fontFamily: fontHeading }}>
              Collections to be deleted:
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedCollections.map((col) => (
                <span
                  key={col}
                  className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium"
                >
                  {AVAILABLE_COLLECTIONS.find(c => c.value === col)?.label || col}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-[#056daa] bg-white text-[#056daa] text-sm font-semibold uppercase hover:bg-[#F7F9FB]"
                style={{ letterSpacing: '1px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 bg-[#E74C3C] text-white text-sm font-semibold uppercase hover:bg-[#C0392B]"
                style={{ letterSpacing: '1px' }}
              >
            I Understand, Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export { DataManagementSection, DeleteWarningModal };
export default DataManagementSection;
