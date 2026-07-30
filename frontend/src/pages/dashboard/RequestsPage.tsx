import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useToast } from '../../core/contexts/ToastContext';
import IncomingCorrespondences from '../../core/components/requests/IncomingCorrespondences';
import RequestStatistics from '../../core/components/requests/RequestStatistics';
import RequestForm from '../../core/components/requests/RequestForm';
import RequestDetails from '../../core/components/requests/RequestDetails';
import requestService, { type RequestDoc } from '../../core/services/requestService';

const RequestsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<RequestDoc | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleDetailsClose = () => {
    setSelectedRequest(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <IncomingCorrespondences
          key={refreshKey}
          onRequestClick={handleRequestClick}
          onNewRequest={handleNewRequest}
        />
      </div>
      <div>
        <RequestStatistics key={`stats-${refreshKey}`} />
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
    </div>
  );
};

export default RequestsPage;
