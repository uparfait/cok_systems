import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useToast } from '../../core/contexts/ToastContext';
import IncomingCorrespondences from '../../core/components/requests/IncomingCorrespondences';
import RequestStatistics from '../../core/components/requests/RequestStatistics';
import OrientationStats from '../../core/components/requests/OrientationStats';
import RequestForm from '../../core/components/requests/RequestForm';
import RequestDetails from '../../core/components/requests/RequestDetails';
import ExportModal from '../../core/components/requests/ExportModal';
import OutgoingDetails from '../../core/components/requests/OutgoingDetails';
import OutgoingForm from '../../core/components/requests/OutgoingForm';
import OutgoingExportModal from '../../core/components/requests/OutgoingExportModal';
import requestService, { type RequestDoc } from '../../core/services/requestService';
import outgoingService, { type OutgoingDoc } from '../../core/services/outgoingService';

const RequestsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<RequestDoc | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOutgoing, setSelectedOutgoing] = useState<OutgoingDoc | null>(null);
  const [showOutgoingForm, setShowOutgoingForm] = useState(false);
  const [showOutgoingExport, setShowOutgoingExport] = useState(false);
  const [outgoingRequestData, setOutgoingRequestData] = useState<Partial<OutgoingDoc> | null>(null);
  const [outgoingLoading, setOutgoingLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#056daa', borderTopColor: 'transparent' }}></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleDetailsClose = () => {
    setSelectedRequest(null);
  };

  const handleRequestOutgoingClick = async (request: RequestDoc) => {
    setSelectedRequest(request);
    setOutgoingLoading(true);
    try {
      const res = await outgoingService.getByRequest(request._id);
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        const data = res.data as OutgoingDoc | null;
        if (data) {
          setSelectedOutgoing(data);
        } else {
          setSelectedOutgoing(null);
          setOutgoingRequestData({
            request_id: request._id,
            reference_number: request.reference_number || '',
            department_number: request.department?.name || request.department?._id || '',
            date_of_reception: request.reception_date || '',
            subject: request.subject || '',
          });
          setShowOutgoingForm(true);
        }
      }
    } catch (error) {
      setSelectedOutgoing(null);
      setOutgoingRequestData({
        request_id: request._id,
        reference_number: request.reference_number || '',
        department_number: request.department?.name || request.department?._id || '',
        date_of_reception: request.reception_date || '',
        subject: request.subject || '',
      });
      setShowOutgoingForm(true);
    } finally {
      setOutgoingLoading(false);
    }
  };

  const handleCreateOutgoingFromCompleted = async (request: RequestDoc) => {
    setSelectedRequest(null);
    setOutgoingRequestData({
      request_id: request._id,
      reference_number: request.reference_number || '',
      department_number: request.department?.name || request.department?._id || '',
      date_of_reception: request.reception_date || '',
      subject: request.subject || '',
    });
    setShowOutgoingForm(true);
  };

  const handleOutgoingItemClick = (outgoing: OutgoingDoc) => {
    setSelectedOutgoing(outgoing);
  };

  const handleNewOutgoing = () => {
    setSelectedOutgoing(null);
    setOutgoingRequestData(null);
    setShowOutgoingForm(true);
  };

  const handleExportClose = () => {
    setShowExport(false);
  };

  const handleOutgoingSuccess = async () => {
    setShowOutgoingForm(false);
    if (outgoingRequestData?.request_id) {
      try {
        await requestService.update(outgoingRequestData.request_id, { status: 'Completed' });
      } catch (error) {
        console.error('Failed to update request status:', error);
      }
    }
    setOutgoingRequestData(null);
    setRefreshKey((k) => k + 1);
    showSuccess('Outgoing saved successfully');
  };

  const handleOutgoingFormClose = () => {
    setShowOutgoingForm(false);
    setOutgoingRequestData(null);
  };

  const handleOutgoingDetailsClose = () => {
    setSelectedOutgoing(null);
  };

  const handleOutgoingExportClose = () => {
    setShowOutgoingExport(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <IncomingCorrespondences
          key={refreshKey}
          onRequestClick={handleRequestClick}
          onNewRequest={handleNewRequest}
          onExport={() => setShowExport(true)}
          onOutgoingExport={() => setShowOutgoingExport(true)}
          onOutgoingClick={handleOutgoingItemClick}
          onNewOutgoing={handleNewOutgoing}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <RequestStatistics key={`stats-${refreshKey}`} />
        </div>
        <div>
          <OrientationStats key={`orientation-${refreshKey}`} />
        </div>
      </div>

      {showForm && (
        <RequestForm
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {selectedRequest && (
        <RequestDetails
          request={selectedRequest}
          onClose={handleDetailsClose}
          onUpdate={handleDetailsClose}
          onOutgoingClick={handleRequestOutgoingClick}
          onCreateOutgoingFromCompleted={handleCreateOutgoingFromCompleted}
          outgoingLoading={outgoingLoading}
        />
      )}

      {showExport && <ExportModal onClose={handleExportClose} />}

      {showOutgoingForm && (
        <OutgoingForm
          onClose={handleOutgoingFormClose}
          onSuccess={handleOutgoingSuccess}
          requestData={outgoingRequestData || undefined}
        />
      )}

      {selectedOutgoing && (
        <OutgoingDetails
          outgoing={selectedOutgoing}
          onClose={handleOutgoingDetailsClose}
          onUpdate={handleOutgoingDetailsClose}
        />
      )}

      {showOutgoingExport && <OutgoingExportModal onClose={handleOutgoingExportClose} />}
    </div>
  );
};

export default RequestsPage;
