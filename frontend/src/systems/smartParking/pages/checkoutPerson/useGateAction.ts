import { useCallback, useState } from 'react';
import { serviceDeliveryService } from '../../../../core/services/adminService';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import { useToast } from '../../../../core/contexts/ToastContext';
import type { GateAction, GateOutcome, InHouseVisit } from './types';
import { ACTION_SUCCESS, actionFor } from './types';

interface ActionResponse {
  success?: boolean;
  message?: string;
  checked_out?: boolean;
}

const runAction = (action: GateAction, visitId: string, badge: string): Promise<ActionResponse> => {
  if (action === 'checkout') return serviceDeliveryService.checkOut(visitId);
  if (action === 'leave') return serviceDeliveryService.partialExit(visitId);
  return serviceDeliveryService.returnVisitor(visitId, badge.trim() || null);
};

export const useGateAction = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [selected, setSelected] = useState<InHouseVisit | null>(null);
  const [action, setAction] = useState<GateAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [badge, setBadge] = useState('');

  const open = useCallback((row: InHouseVisit) => {
    setSelected(row);
    setAction(actionFor(row));
    setFailure(null);
    setBadge('');
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setSelected(null);
    setAction(null);
    setFailure(null);
  }, [busy]);

  const confirm = useCallback(async (): Promise<GateOutcome | null> => {
    if (!selected || !action || busy) return null;
    const id = selected._id;
    setBusy(true);
    setFailure(null);
    try {
      const response = await runAction(action, id, badge);
      if (response?.success === false) {
        const message = response.message || 'The action could not be completed';
        setFailure(message);
        showError(message);
        return { id, removed: false };
      }
      const message = response?.message || ACTION_SUCCESS[action];
      const checkedOut = action === 'leave' && response?.checked_out === true;
      if (checkedOut) showInfo(message);
      else showSuccess(message);
      setSelected(null);
      setAction(null);
      return { id, removed: action === 'checkout' || checkedOut };
    } catch (error) {
      const info = failureOf(error);
      setFailure(info.message);
      if (info.code === 'CAR_STILL_PARKED' || info.status === 409) showWarning(info.message);
      else showError(info.message);
      return { id, removed: info.status === 404 };
    } finally {
      setBusy(false);
    }
  }, [selected, action, busy, badge, showSuccess, showError, showWarning, showInfo]);

  return { selected, action, busy, failure, badge, setBadge, open, close, confirm };
};

export default useGateAction;
