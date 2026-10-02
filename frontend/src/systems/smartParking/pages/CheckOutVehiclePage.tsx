import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useParkingEvents } from '../../../core/hooks/useParkingEvents';
import MainLayout from '../../../core/components/Layout/MainLayout';
import ActiveParkingTable from './checkoutVehicle/ActiveParkingTable';
import CheckoutConfirmOverlay from './checkoutVehicle/CheckoutConfirmOverlay';
import { useActiveParking } from './checkoutVehicle/useActiveParking';
import type { ParkingRow } from './checkoutVehicle/parkingRows';

const NEUTRAL_LIGHT = '#F7F9FB';
const WHITE = '#FFFFFF';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const CheckOutVehiclePage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();
  const parking = useActiveParking(isAuthenticated, showError);
  const [selected, setSelected] = useState<ParkingRow | null>(null);
  const { reloadSilently, removeRow, setPaused } = parking;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useParkingEvents({ refetch: reloadSilently });

  const openCheckout = useCallback((row: ParkingRow) => {
    setPaused(true);
    setSelected(row);
  }, [setPaused]);

  const closeCheckout = useCallback(() => {
    setSelected(null);
    setPaused(false);
  }, [setPaused]);

  const handleCheckedOut = useCallback((row: ParkingRow) => {
    removeRow(row);
    reloadSilently();
  }, [removeRow, reloadSilently]);

  return (
    <MainLayout>
      <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="p-3 mb-3" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                <input
                  type="text"
                  value={parking.query}
                  onChange={(e) => parking.setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') parking.searchNow(); }}
                  placeholder="Search by plate, badge, name, telephone, email or ID number..."
                  className="w-full pl-9 pr-3 py-2 cok-auth-input"
                />
              </div>
              <button
                type="button"
                onClick={parking.searchNow}
                className="cok-btn-primary w-auto! px-4! py-2! flex items-center gap-2 shadow-md"
              >
                <FiSearch className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <ActiveParkingTable
            rows={parking.rows}
            loading={parking.loading}
            loadingText={parking.loadingText}
            onCheckout={openCheckout}
          />
          <div className="px-2 py-2 flex flex-wrap gap-2 justify-between items-center" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
            <p className="text-xs" style={{ color: '#555555' }}>
              Showing {parking.rows.length} of {parking.total} results
            </p>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => parking.goToPage(parking.page - 1)}
                disabled={parking.page <= 1 || parking.loading}
                className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed!"
              >
                Previous
              </button>
              <span className="text-sm py-1 px-3" style={{ color: '#555555' }}>
                Page {parking.page} of {parking.pages}
              </span>
              <button
                type="button"
                onClick={() => parking.goToPage(parking.page + 1)}
                disabled={parking.page >= parking.pages || parking.loading}
                className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed!"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <CheckoutConfirmOverlay record={selected} onClose={closeCheckout} onCheckedOut={handleCheckedOut} />
      </div>
    </MainLayout>
  );
};

export default CheckOutVehiclePage;
