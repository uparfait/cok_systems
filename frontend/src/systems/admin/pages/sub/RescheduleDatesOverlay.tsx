import React from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';

const fontHeading = "'Montserrat', sans-serif";

interface RescheduleDatesOverlayProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  busy: boolean;
  onClose: () => void;
  onApply: () => void;
}

const RescheduleDatesOverlay: React.FC<RescheduleDatesOverlayProps> = ({ open, title, description, start, end, onStartChange, onEndChange, busy, onClose, onApply }) => (
  <OverlayShell
    open={open}
    title={title}
    onClose={onClose}
    busy={busy}
    width="sm"
    footer={
      <button type="button" onClick={onApply} disabled={busy} className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Working...' : 'Apply New Dates'}
      </button>
    }
  >
    <p className="text-sm text-[#555555] mb-4">{description}</p>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="cok-auth-label">Start Date</label>
        <input type="date" value={start} onChange={e => onStartChange(e.target.value)} disabled={busy} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
      </div>
      <div>
        <label className="cok-auth-label">End Date</label>
        <input type="date" value={end} onChange={e => onEndChange(e.target.value)} disabled={busy} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
      </div>
    </div>
  </OverlayShell>
);

export default RescheduleDatesOverlay;
