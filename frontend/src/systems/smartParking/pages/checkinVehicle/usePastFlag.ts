import { useCallback, useRef, useState } from 'react';
import { parkingService } from '../../../../core/services/adminService';
import { useToast } from '../../../../core/contexts/ToastContext';
import type { PastFlagInfo } from './vehicleCheckin';
import { DEFAULT_FLAG_REASON, cleanPlate, formatMinutes } from './vehicleCheckin';

interface FlagHistoryRow {
  plate_number?: string;
  flagged_at?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  total_duration_minutes?: number | null;
  overstay_minutes?: number | null;
  flag_reason?: string;
}

const HISTORY_LIMIT = 50;

const fallbackFlag = (): PastFlagInfo => ({
  count: 1,
  flagged_at: null,
  check_in: null,
  check_out: null,
  total_duration_minutes: null,
  overstay_minutes: null,
  flag_reason: DEFAULT_FLAG_REASON,
});

export function usePastFlag() {
  const { showWarning } = useToast();
  const [pastFlag, setPastFlag] = useState<PastFlagInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);

  const reset = useCallback(() => {
    sequence.current += 1;
    setPastFlag(null);
    setLoading(false);
  }, []);

  const load = useCallback(async (plate: string) => {
    const current = ++sequence.current;
    const target = cleanPlate(plate);
    setPastFlag(null);
    setLoading(true);
    try {
      const response = await parkingService.getFlagHistory(1, HISTORY_LIMIT, target);
      if (current !== sequence.current) return;
      const rows: FlagHistoryRow[] = response?.success && Array.isArray(response.data) ? response.data : [];
      const exact = rows.filter((row) => cleanPlate(row.plate_number || '') === target);
      const latest = exact[0] || null;
      setPastFlag({
        count: Math.max(exact.length, 1),
        flagged_at: latest?.flagged_at || null,
        check_in: latest?.check_in || null,
        check_out: latest?.check_out || null,
        total_duration_minutes: latest?.total_duration_minutes ?? null,
        overstay_minutes: latest?.overstay_minutes ?? null,
        flag_reason: latest?.flag_reason || DEFAULT_FLAG_REASON,
      });
      showWarning(latest?.total_duration_minutes != null
        ? `This vehicle was flagged before: parked ${formatMinutes(latest.total_duration_minutes)}, overstayed ${formatMinutes(latest.overstay_minutes)}.`
        : 'This vehicle was flagged before for overstaying.');
    } catch {
      if (current !== sequence.current) return;
      setPastFlag(fallbackFlag());
      showWarning('This vehicle was flagged before for overstaying.');
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [showWarning]);

  return { pastFlag, loading, load, reset };
}

export default usePastFlag;
