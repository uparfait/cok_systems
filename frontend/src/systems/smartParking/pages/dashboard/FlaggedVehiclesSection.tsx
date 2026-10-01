import React from 'react';
import { BsExclamationTriangle, BsShieldCheck } from 'react-icons/bs';
import type { ParkingRow } from '../checkoutVehicle/parkingRows';
import FlaggedVehiclesTable from './FlaggedVehiclesTable';
import { CARD_SHADOW, NEUTRAL_DARK, PRIMARY, PRIMARY_HOVER, WHITE, fontHeading } from './dashboardTheme';

export const FLAGGED_PREVIEW_ROWS = 5;

interface FlaggedVehiclesSectionProps {
  rows: ParkingRow[];
  total: number;
  loading: boolean;
  onViewAll: () => void;
  onCheckout: (row: ParkingRow) => void;
}

const FlaggedVehiclesSection: React.FC<FlaggedVehiclesSectionProps> = ({ rows, total, loading, onViewAll, onCheckout }) => {
  const preview = rows.slice(0, FLAGGED_PREVIEW_ROWS);

  return (
    <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2" style={{ backgroundColor: 'rgba(231,76,60,0.1)' }}>
            <BsExclamationTriangle className="w-5 h-5 text-[#E74C3C]" />
          </div>
          <h2 className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Flagged Vehicles</h2>
        </div>
        <div className="flex items-center gap-2">
          {total > preview.length ? (
            <span className="text-sm text-[#555555]">
              Showing {preview.length} of {total}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onViewAll}
            disabled={total === 0}
            className="px-3 py-1.5 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            View All ({total})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent mb-2"></div>
          <p className="text-sm">Loading flagged vehicles...</p>
        </div>
      ) : preview.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
          <BsShieldCheck className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No flagged vehicles at the moment</p>
        </div>
      ) : (
        <FlaggedVehiclesTable rows={preview} onCheckout={onCheckout} />
      )}
    </div>
  );
};

export default FlaggedVehiclesSection;
