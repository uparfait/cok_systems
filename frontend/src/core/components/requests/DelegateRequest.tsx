import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import IncomingCorrespondences from './IncomingCorrespondences';
import RequestStatistics from './RequestStatistics';
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
    setRefreshKey((k) => k + 1);
  };

  const handleExportClose = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4"
          style={{ backgroundColor: '#056daa' }}
        >
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Incoming Correspondences
            </h2>
            <p className="text-xs text-white/80">Manage and track incoming correspondence requests</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
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
          <div className="xl:col-span-1">
            <RequestStatistics />
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
