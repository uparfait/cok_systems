import { FiTrash2 } from 'react-icons/fi';

const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white w-full max-w-sm p-5 sm:p-6" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 shrink-0" style={{ backgroundColor: '#FDECEA' }}>
            <FiTrash2 className="w-6 h-6" style={{ color: DANGER }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{title}</h3>
            <p className="text-sm mt-1 break-words" style={{ color: GRAY_DISABLED }}>{message}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cok-btn-outlined flex-1 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors disabled:opacity-60"
            style={{ backgroundColor: DANGER, fontFamily: fontHeading, borderRadius: 0, border: 0 }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = '#C0392B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
