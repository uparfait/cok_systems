import { useState } from 'react';
import OverlayCloseButton from '../overlay/OverlayCloseButton';
import IncomingCorrespondences from './IncomingCorrespondences';
import RequestStatistics from './RequestStatistics';
import OrientationStats from './OrientationStats';
import RequestForm from './RequestForm';
import RequestDetails from './RequestDetails';
import ExportModal from './ExportModal';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { useToast } from '../../../core/contexts/ToastContext';

const DelegateRequest: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDoc | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showSuccess } = useToast();

  const handleRequestClick = (request: RequestDoc) => {
    setSelectedRequest(request);
  };

  const handleNewRequest = () => {
    setSelectedRequest(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
    showSuccess('Request saved successfully');
  };

  const handleDetailsClose = () => {
    setSelectedRequest(null);
  };

  const handleExportClose = () => {
    setShowExport(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Incoming Correspondences
            </h2>
            <p className="text-xs text-gray-500">Manage and track incoming correspondence requests</p>
          </div>
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <IncomingCorrespondences
                key={refreshKey}
                onRequestClick={handleRequestClick}
                onNewRequest={handleNewRequest}
                onExport={() => setShowExport(true)}
              />
            </div>
          <div className="xl:col-span-1 space-y-4">
            <RequestStatistics />
            <OrientationStats />
          </div>
        </div>
      </div>

      {showForm && (
        <RequestForm
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {selectedRequest && (
        <RequestDetails
          request={selectedRequest}
          onClose={handleDetailsClose}
          onUpdate={handleDetailsClose}
        />
      )}

      {showExport && <ExportModal onClose={handleExportClose} />}
    </div>
  );
};

export default DelegateRequest;
