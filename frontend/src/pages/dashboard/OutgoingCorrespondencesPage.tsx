import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useToast } from '../../core/contexts/ToastContext';
import OutgoingCorrespondences from '../../core/components/requests/OutgoingCorrespondences';
import OutgoingDetails from '../../core/components/requests/OutgoingDetails';
import OutgoingForm from '../../core/components/requests/OutgoingForm';
import OutgoingExportModal from '../../core/components/requests/OutgoingExportModal';
import outgoingService, { type OutgoingDoc } from '../../core/services/outgoingService';
import requestService, { type RequestDoc } from '../../core/services/requestService';

const OutgoingCorrespondencesPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess } = useToast();
  const [selectedOutgoing, setSelectedOutgoing] = useState<OutgoingDoc | null>(null);
  const [showOutgoingForm, setShowOutgoingForm] = useState(false);
  const [showOutgoingExport, setShowOutgoingExport] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDoc | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [outgoingFormRequestId, setOutgoingFormRequestId] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#E65100', borderTopColor: 'transparent' }}></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleOutgoingClick = (outgoing: OutgoingDoc) => {
    setSelectedOutgoing(outgoing);
  };

  const handleNewOutgoing = () => {
    setSelectedOutgoing(null);
    setShowOutgoingForm(true);
  };

  const handleOutgoingSuccess = () => {
    setShowOutgoingForm(false);
    setOutgoingFormRequestId(null);
    setRefreshKey((k) => k + 1);
    showSuccess('Outgoing saved successfully');
  };

  const handleOutgoingFormClose = () => {
    setShowOutgoingForm(false);
    setOutgoingFormRequestId(null);
  };

  const handleDetailsClose = () => {
    setSelectedOutgoing(null);
    setSelectedRequest(null);
  };

  const handleExportClose = () => {
    setShowOutgoingExport(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <OutgoingCorrespondences
          key={refreshKey}
          onOutgoingClick={handleOutgoingClick}
          onNewOutgoing={handleNewOutgoing}
          onExport={() => setShowOutgoingExport(true)}
        />
      </div>

      {showOutgoingForm && (
        <OutgoingForm
          onClose={handleOutgoingFormClose}
          onSuccess={handleOutgoingSuccess}
          requestData={outgoingFormRequestId ? { _id: outgoingFormRequestId } : undefined}
        />
      )}

      {selectedOutgoing && (
        <OutgoingDetails
          outgoing={selectedOutgoing}
          onClose={handleDetailsClose}
          onUpdate={handleDetailsClose}
        />
      )}

      {showOutgoingExport && <OutgoingExportModal onClose={handleExportClose} />}
    </div>
  );
};

export default OutgoingCorrespondencesPage;
