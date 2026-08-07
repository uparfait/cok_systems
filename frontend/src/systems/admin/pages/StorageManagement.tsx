import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import storageManagementService from '../../../core/services/storageManagement';
import { DataManagementSection, type DeleteStep } from './components/DataManagementSection';
import StorageStatsCards from './components/StorageStatsCards';
import StorageBarChart from './components/StorageBarChart';
import { FiHardDrive } from 'react-icons/fi';

const PRIMARY = '#056daa';
const NEUTRAL_LIGHT = '#F7F9FB';
const WHITE = '#FFFFFF';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const fontHeading = "'Montserrat', sans-serif";

interface CollectionStat {
  name: string;
  collectionName: string;
  count: number;
  size: number;
  formattedSize: string;
  avgObjSize: number;
}

const StorageManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [totalStorage, setTotalStorage] = useState(0);
  const [totalStorageFormatted, setTotalStorageFormatted] = useState('0 B');
  const [totalRecords, setTotalRecords] = useState(0);
  const [collections, setCollections] = useState<CollectionStat[]>([]);

  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [deletePeriod, setDeletePeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'year' | 'range'>('month');
  const [deleteFrom, setDeleteFrom] = useState('');
  const [deleteTo, setDeleteTo] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteResults, setDeleteResults] = useState<any[]>([]);
  const [showDeleteWarnings, setShowDeleteWarnings] = useState(false);
  const [dataManagementLoading, setDataManagementLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, authLoading, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await storageManagementService.getStorageStats({});
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        const data = res.data as any;
        setTotalStorage(data.totalStorage || 0);
        setTotalStorageFormatted(data.totalStorageFormatted || '0 B');
        setTotalRecords(data.totalRecords || 0);
        setCollections(data.collections || []);
      }
    } catch (error: any) {
      console.error(error);
      showError(error?.message || 'Failed to load storage stats');
    }
  }, [showError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const toggleCollection = (value: string) => {
    setSelectedCollections(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  };

  const handleConfirmWarnings = async () => {
    setShowDeleteWarnings(false);
    setDataManagementLoading(true);
    try {
      const res = await storageManagementService.requestDeleteToken({
        collections: selectedCollections,
        period: deletePeriod,
        from: deleteFrom || undefined,
        to: deleteTo || undefined,
        reason: deleteReason,
      });
      if (res && typeof res === 'object' && 'success' in res && res.success) {
        const data = res as any;
        setRequestKey(data.data?.requestKey || '');
        setDeleteStep('token');
        showSuccess('Delete confirmation token sent to your email');
      } else {
        showError('Failed to send delete token');
      }
    } catch (error: any) {
      showError(error?.message || 'Failed to request delete token');
    } finally {
      setDataManagementLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!requestKey || !deleteToken) {
      showWarning('Please enter the confirmation token');
      return;
    }
    setDeleteStep('processing');
    try {
      const res = await storageManagementService.confirmDelete({
        requestKey,
        token: deleteToken,
      });
      if (res && typeof res === 'object' && 'success' in res && res.success) {
        const data = res as any;
        setDeleteResults(data.data?.results || []);
        setDeleteStep('done');
        showSuccess(data.message || 'Data deleted successfully');
      } else {
        showError('Failed to confirm delete');
        setDeleteStep('token');
      }
    } catch (error: any) {
      showError(error?.message || 'Failed to confirm delete');
      setDeleteStep('token');
    }
  };

  const resetDeleteFlow = () => {
    setDeleteStep('idle');
    setSelectedCollections([]);
    setDeletePeriod('month');
    setDeleteFrom('');
    setDeleteTo('');
    setDeleteReason('');
    setRequestKey('');
    setDeleteToken('');
    setDeleteResults([]);
    setShowDeleteWarnings(false);
  };

  return (
    <div className="space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
    

      <StorageStatsCards
        totalStorageFormatted={totalStorageFormatted}
        totalRecords={totalRecords}
        onRefresh={fetchStats}
      />

      <StorageBarChart
        collections={collections}
      />

      <DataManagementSection
        deleteStep={deleteStep}
        selectedCollections={selectedCollections}
        deletePeriod={deletePeriod}
        deleteFrom={deleteFrom}
        deleteTo={deleteTo}
        deleteReason={deleteReason}
        requestKey={requestKey}
        deleteToken={deleteToken}
        deleteResults={deleteResults}
        showDeleteWarnings={showDeleteWarnings}
        loading={dataManagementLoading}
        onToggleCollection={toggleCollection}
        onDeletePeriodChange={setDeletePeriod as any}
        onDeleteFromChange={setDeleteFrom}
        onDeleteToChange={setDeleteTo}
        onDeleteReasonChange={setDeleteReason}
        onDeleteTokenChange={setDeleteToken}
        onStartDelete={() => {}}
        onConfirmWarnings={handleConfirmWarnings}
        onConfirmDelete={handleConfirmDelete}
        onCancelWarnings={() => setShowDeleteWarnings(false)}
        onResetDeleteFlow={resetDeleteFlow}
        onShowWarningsChange={setShowDeleteWarnings}
        showWarning={showWarning}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  );
};

export default StorageManagement;
