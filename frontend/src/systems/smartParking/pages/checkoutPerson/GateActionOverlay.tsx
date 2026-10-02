import React from 'react';
import { FiCheckCircle, FiLogOut } from 'react-icons/fi';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import type { GateAction, InHouseVisit } from './types';
import { ACTION_TITLE, dash, hasVehicle, plateOf } from './types';

const CONFIRM_LABEL: Record<GateAction, string> = {
  checkout: 'Confirm Checkout',
  leave: 'Partial Exit',
  return: 'Returned',
};

const BUSY_LABEL: Record<GateAction, string> = {
  checkout: 'Checking out...',
  leave: 'Saving...',
  return: 'Saving...',
};

const TONE: Record<GateAction, { bg: string; color: string }> = {
  checkout: { bg: 'rgba(231,76,60,0.1)', color: '#E74C3C' },
  leave: { bg: 'rgba(243,156,18,0.1)', color: '#F39C12' },
  return: { bg: 'rgba(76,175,80,0.1)', color: '#4CAF50' },
};

const explanationOf = (action: GateAction, plate: string): string => {
  const car = plate || 'the car';
  if (action === 'checkout') return 'The visit is closed and the visitor leaves the premises.';
  if (action === 'leave') return `The visitor steps out while ${car} stays parked. The visit stays open until the car is checked out at the vehicle exit. The badge is taken back.`;
  return 'The visitor came back inside and is marked as inside again. A badge given now is saved on the visit and on the parked car.';
};

const Detail: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
  </div>
);

interface GateActionOverlayProps {
  row: InHouseVisit;
  action: GateAction;
  busy: boolean;
  failure: string | null;
  badge: string;
  onBadgeChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const GateActionOverlay: React.FC<GateActionOverlayProps> = ({ row, action, busy, failure, badge, onBadgeChange, onConfirm, onClose }) => {
  const plate = plateOf(row);
  const vehicle = hasVehicle(row);
  const tone = TONE[action];
  const Icon = action === 'return' ? FiCheckCircle : FiLogOut;

  return (
    <OverlayShell
      title={ACTION_TITLE[action]}
      subtitle={row.full_name || undefined}
      onClose={onClose}
      busy={busy}
      width="sm"
      footer={
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="cok-btn-primary w-auto! px-6! py-2! inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="w-4 h-4" />
          )}
          {busy ? BUSY_LABEL[action] : CONFIRM_LABEL[action]}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tone.bg }}>
            <Icon className="w-5 h-5" style={{ color: tone.color }} />
          </div>
          <p className="text-sm text-gray-700">{explanationOf(action, plate)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-[#F7F9FB]">
          <Detail label="ID type" value={dash(row.identification?.id_type)} />
          <Detail label="ID number" value={dash(row.identification?.number)} />
          <Detail label="Telephone" value={dash(row.telephone)} />
          <Detail label="Gender" value={dash(row.gender)} />
          <Detail label="Email" value={dash(row.email)} wide />
          <Detail label="Badge" value={dash(row.badge_number)} />
          <Detail label="Visits" value={row.N_visits ?? 0} />
          <Detail label="Status" value={row.marked_as_out ? 'Stepped out' : 'Inside'} />
          <Detail label="Check-in" value={formatDateTime(row.entry_date)} />
          <Detail label="Duration" value={dash(row.current_duration)} />
          <Detail label="Vehicle plate" value={vehicle ? plate || '-' : 'No vehicle'} wide />
        </div>

        {vehicle ? (
          <div className="px-3 py-2 text-xs font-medium border border-amber-300 bg-amber-50 text-amber-900">
            This visitor came with vehicle {plate || '-'}. The car is still parked.
          </div>
        ) : null}

        {action === 'return' ? (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Badge Number (optional)</label>
            <input
              type="text"
              value={badge}
              onChange={(e) => onBadgeChange(e.target.value)}
              disabled={busy}
              className="cok-auth-input pr-3 py-2 text-sm"
              placeholder="Enter badge number"
            />
          </div>
        ) : null}

        {failure ? (
          <div className="px-3 py-2 text-xs font-medium border border-red-200 bg-red-50 text-red-700">{failure}</div>
        ) : null}
      </div>
    </OverlayShell>
  );
};

export default GateActionOverlay;
