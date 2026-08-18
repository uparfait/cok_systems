import React, { useState, useCallback } from 'react';
import { FiDatabase, FiRefreshCw } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const GRAY_DISABLED = '#9E9E9E';
const WHITE = '#FFFFFF';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const fontHeading = "'Montserrat', sans-serif";

interface StorageStatsCardsProps {
  totalStorageFormatted: string;
  totalRecords: number;
  onRefresh: () => void;
}

const StorageStatsCards: React.FC<StorageStatsCardsProps> = ({
  totalStorageFormatted,
  totalRecords,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await onRefresh();
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [onRefresh]);

  React.useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: WHITE,
        boxShadow: CARD_SHADOW,
        borderRadius: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="p-1.5"
          style={{
            backgroundColor: 'rgba(5,109,170,0.08)',
            borderRadius: 0,
          }}
        >
          <FiDatabase className="w-4 h-4" style={{ color: PRIMARY }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
            Total Storage Used
          </h3>
          <p className="text-xs" style={{ color: GRAY_DISABLED }}>
            {totalRecords.toLocaleString()} total records across all collections
          </p>
        </div>
      </div>
      {loading && firstLoad ? (
        <div className="flex items-center justify-center py-4">
          <SpiralLoader />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-3xl font-bold" style={{ fontFamily: fontHeading, color: PRIMARY }}>
            {totalStorageFormatted}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-[#056daa] text-[#056daa] text-sm font-semibold uppercase hover:bg-[#056daa] hover:text-white transition-all disabled:opacity-50"
            style={{ letterSpacing: '1px' }}
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default StorageStatsCards;
