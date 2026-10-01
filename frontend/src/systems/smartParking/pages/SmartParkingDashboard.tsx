import React, { useCallback, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import MainLayout from '../../../core/components/Layout/MainLayout';
import ExportVisitorsModal from '../../../core/components/requests/ExportVisitorsModal';
import CheckoutConfirmOverlay from './checkoutVehicle/CheckoutConfirmOverlay';
import type { ParkingRow } from './checkoutVehicle/parkingRows';
import DashboardStatCards from './dashboard/DashboardStatCards';
import HourlyParkingChart from './dashboard/HourlyParkingChart';
import FlaggedVehiclesSection from './dashboard/FlaggedVehiclesSection';
import FlaggedVehiclesOverlay from './dashboard/FlaggedVehiclesOverlay';
import { useDashboardData } from './dashboard/useDashboardData';
import { NEUTRAL_LIGHT, PRIMARY, PRIMARY_HOVER, fontHeading } from './dashboard/dashboardTheme';

const SmartParkingDashboard: React.FC = () => {
  const dashboard = useDashboardData();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFlaggedOverlay, setShowFlaggedOverlay] = useState(false);
  const [checkoutRow, setCheckoutRow] = useState<ParkingRow | null>(null);
  const { silentRefresh } = dashboard;

  const handleCheckedOut = useCallback(() => {
    silentRefresh();
  }, [silentRefresh]);

  if (dashboard.authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#056daa] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#555555] font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-2 sm:p-3 md:p-4 lg:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <DashboardStatCards stats={dashboard.stats} loading={dashboard.statsLoading} />

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="w-full px-6 py-3 text-white font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            <FiDownload className="w-5 h-5" />
            EXPORT VISITORS DATA
          </button>
        </div>

        <HourlyParkingChart
          data={dashboard.hourly}
          loading={dashboard.analyticsLoading}
          firstLoad={dashboard.hourlyFirstLoad}
          onRefresh={dashboard.fetchHourlyAnalytics}
        />

        <FlaggedVehiclesSection
          rows={dashboard.flagged}
          total={dashboard.flaggedTotal}
          loading={dashboard.flaggedLoading}
          onViewAll={() => setShowFlaggedOverlay(true)}
          onCheckout={setCheckoutRow}
        />
      </div>

      {showFlaggedOverlay ? (
        <FlaggedVehiclesOverlay
          onClose={() => setShowFlaggedOverlay(false)}
          busy={!!checkoutRow}
          refreshToken={dashboard.refreshToken}
          onCheckout={setCheckoutRow}
        />
      ) : null}

      <CheckoutConfirmOverlay
        record={checkoutRow}
        onClose={() => setCheckoutRow(null)}
        onCheckedOut={handleCheckedOut}
        zIndex={1100}
      />

      {showExportModal && (
        <ExportVisitorsModal onClose={() => setShowExportModal(false)} />
      )}
    </MainLayout>
  );
};

export default SmartParkingDashboard;
