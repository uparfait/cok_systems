import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import VisitorSendForm from './VisitorSendForm';
import { failureOf, formatDateTime, visitorApi } from './visitorApi';
import type { DepartmentTarget, VisitorDetails } from './visitorTypes';

interface VisitorActionsProps {
  details: VisitorDetails;
  onChanged: (next?: VisitorDetails) => void;
  setBusy: (busy: boolean) => void;
}

type ActionKey = '' | 'serve' | 'complete' | 'transfer' | 'send';

const VisitorActions: React.FC<VisitorActionsProps> = ({ details, onChanged, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const { permissions, visitor, current_visit: visit } = details;
  const [action, setAction] = useState<ActionKey>('');
  const [target, setTarget] = useState<DepartmentTarget | null>(null);
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState(false);

  if (!visit) return null;

  const isEmployee = permissions.role_slug === 'employee';
  const server = permissions.serving_by;
  const servedByOther = !!visit.is_being_served && !permissions.can_complete;

  const run = async (label: string, request: () => Promise<{ data?: VisitorDetails; message?: string }>) => {
    setWorking(true);
    setBusy(true);
    try {
      const response = await request();
      showSuccess(response?.message || label);
      setAction('');
      setTarget(null);
      setNotes('');
      onChanged(response?.data);
    } catch (error) {
      showError(failureOf(error).message);
      onChanged();
    } finally {
      setWorking(false);
      setBusy(false);
    }
  };

  const options: { key: ActionKey; label: string }[] = isEmployee
    ? [
      ...(permissions.can_serve ? [{ key: 'serve' as ActionKey, label: 'Serve this visitor' }] : []),
      ...(permissions.can_complete ? [{ key: 'complete' as ActionKey, label: 'Complete my service' }] : []),
      ...(permissions.can_transfer ? [{ key: 'transfer' as ActionKey, label: 'Transfer to a department' }] : []),
    ]
    : (permissions.can_send ? [{ key: 'send' as ActionKey, label: 'Send to department' }] : []);

  return (
    <div className="border-t border-gray-200 pt-4 mt-2 flex flex-col gap-3">
      {server ? (
        <div className={`px-3 py-2 text-xs border ${servedByOther ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-green-300 bg-green-50 text-green-900'}`}>
          {servedByOther ? 'Currently served by ' : 'You are serving this visitor'}
          {servedByOther ? <strong>{server.name || 'another employee'}</strong> : null}
          {server.department_name ? ` (${server.department_name})` : ''}
          {server.started_at ? ` since ${formatDateTime(server.started_at)}` : ''}
          {servedByOther ? '. Nobody else can serve or move this visitor until that service ends; attachments can still be added.' : '.'}
        </div>
      ) : null}

      {options.length === 0 ? (
        <p className="text-xs text-gray-500">{servedByOther ? 'No action is available while another person is serving this visitor.' : 'No action is available for your role on this visitor.'}</p>
      ) : (
        <>
          {isEmployee ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">What to do</label>
              <select
                className="w-full sm:w-80 border border-gray-300 bg-white px-3 py-2 text-sm"
                value={action}
                disabled={working}
                onChange={(e) => { setAction(e.target.value as ActionKey); setTarget(null); setNotes(''); }}
              >
                <option value="">Choose an action</option>
                {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          ) : null}

          {(action === 'send' || action === 'transfer') ? <VisitorSendForm value={target} onChange={setTarget} disabled={working} /> : null}

          {(action === 'complete' || action === 'transfer') ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm"
                rows={3}
                value={notes}
                disabled={working}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={action === 'complete' ? 'What was done for the visitor' : 'Why the visitor is transferred'}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!isEmployee && action !== 'send' ? (
              <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={working} onClick={() => setAction('send')}>Send to department</button>
            ) : null}
            {action === 'send' ? (
              <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={working || !target}
                onClick={() => target && run('Visitor sent to the department', () => visitorApi.sendToDepartment(visitor._id, target))}>
                {working ? 'Sending...' : 'Send'}
              </button>
            ) : null}
            {action === 'serve' ? (
              <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={working}
                onClick={() => run('You are now serving this visitor', () => visitorApi.serve(visitor._id))}>
                {working ? 'Starting...' : 'Start serving'}
              </button>
            ) : null}
            {action === 'complete' ? (
              <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={working}
                onClick={() => run('Service completed', () => visitorApi.complete(visitor._id, notes))}>
                {working ? 'Completing...' : 'Complete service'}
              </button>
            ) : null}
            {action === 'transfer' ? (
              <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={working || !target}
                onClick={() => target && run('Visitor transferred', () => visitorApi.transfer(visitor._id, { ...target, notes }))}>
                {working ? 'Transferring...' : 'Transfer'}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default VisitorActions;
