import { FiSlash } from 'react-icons/fi';

const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

export default function EventActionsCancelModal({ cancelTarget, setCancelTarget, cancelReason, setCancelReason, cancelSubmitting, cancelError, confirmCancel }) {
  if (!cancelTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white w-full max-w-sm p-5 sm:p-6" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 shrink-0" style={{ backgroundColor: '#FDECEA' }}>
            <FiSlash className="w-6 h-6" style={{ color: DANGER }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Cancel Action</h3>
            <p className="text-sm mt-1" style={{ color: '#9E9E9E' }}>
              You are about to cancel <span className="font-semibold" style={{ color: NEUTRAL_DARK }}>"{cancelTarget.title}"</span>.
              This action will be marked as cancelled.
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          Reason for cancellation <span style={{ color: DANGER }}>*</span>
        </label>
        <textarea
          rows={4}
          autoFocus
          placeholder="Explain why this action is being cancelled…"
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          maxLength={1000}
          className="w-full cok-auth-input pr-3 py-2 text-sm"
          style={{ paddingLeft: '12px', resize: 'vertical', minHeight: '100px' }}
        />
        <p className="text-xs text-right mt-1" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>{cancelReason.length}/1000</p>

        {cancelError && (
          <div className="p-3 text-xs mt-3" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>
            {cancelError}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setCancelTarget(null)}
            disabled={cancelSubmitting}
            className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go Back
          </button>
          <button
            onClick={confirmCancel}
            disabled={cancelSubmitting || !cancelReason.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
            onMouseEnter={(e) => { if (!cancelSubmitting && cancelReason.trim()) e.currentTarget.style.backgroundColor = '#C0392B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
          >
            <FiSlash className="w-4 h-4" />
            {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
