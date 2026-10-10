import React, { useCallback, useEffect, useRef, useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import type { ParkingRow } from '../checkoutVehicle/parkingRows';
import FlaggedVehiclesTable from './FlaggedVehiclesTable';
import { FLAGGED_PAGE_SIZE, fetchFlaggedVehicles } from './flaggedApi';

interface FlaggedVehiclesOverlayProps {
  onClose: () => void;
  busy?: boolean;
  refreshToken: number;
  onCheckout: (row: ParkingRow) => void;
}

const FlaggedVehiclesOverlay: React.FC<FlaggedVehiclesOverlayProps> = ({ onClose, busy = false, refreshToken, onCheckout }) => {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ParkingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const tokenRef = useRef(refreshToken);

  const load = useCallback(async (target: number, silent: boolean) => {
    const id = requestRef.current + 1;
    requestRef.current = id;
    if (!silent) setLoading(true);
    try {
      const result = await fetchFlaggedVehicles(target);
      if (id !== requestRef.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / FLAGGED_PAGE_SIZE));
      setRows(result.rows);
      setTotal(result.total);
      setError('');
      if (target > lastPage) setPage(lastPage);
    } catch (failure) {
      if (id === requestRef.current && !silent) setError(failureOf(failure).message || 'Failed to load flagged vehicles');
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, false);
  }, [page, load]);

  useEffect(() => {
    if (tokenRef.current === refreshToken) return;
    tokenRef.current = refreshToken;
    load(page, true);
  }, [refreshToken, page, load]);

  const pages = Math.max(1, Math.ceil(total / FLAGGED_PAGE_SIZE));

  return (
    <OverlayShell
      title="Flagged vehicles"
      subtitle={`${total} flagged vehicle${total === 1 ? '' : 's'} still inside. Click a row to open the visitor.`}
      onClose={onClose}
      busy={busy}
      width="full"
    >
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-700 py-6 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#9E9E9E] py-6 text-center">No flagged vehicles at the moment</p>
      ) : (
        <FlaggedVehiclesTable rows={rows} onCheckout={onCheckout} maxHeight="60vh" />
      )}
      {total > FLAGGED_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <span className="text-xs text-[#555555]">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
              className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed!"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              disabled={page >= pages || loading}
              className="cok-btn-outlined px-3! py-1! disabled:opacity-50 disabled:cursor-not-allowed!"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </OverlayShell>
  );
};

export default FlaggedVehiclesOverlay;
