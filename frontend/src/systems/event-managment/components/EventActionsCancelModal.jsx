import { useState } from 'react';
import { FiSlash } from 'react-icons/fi';

const PRIMARY = '#056daa';
const DANGER = '#E53935';
const NEUTRAL_LIGHT = '#F7F9FB';

export default function EventActionsCancelModal({ cancelTarget, setCancelTarget, cancelReason, setCancelReason, cancelSubmitting, cancelError, confirmCancel }) {
  if (!cancelTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white shadow-2xl w-full max-w-sm p-6" style={{ borderRadius: 0 }}>
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 shrink-0" style={{ backgroundColor: '#FFEBEE' }}>
            <FiSlash className="w-6 h-6" style={{ color: '#C62828' }} />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cancel Action</h3>
            <p className="text-sm text-zinc-500 mt-1">
              You are about to cancel <span className="font-semibold text-zinc-800">"{cancelTarget.title}"</span>.
              This action will be marked as cancelled.
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
          Reason for cancellation *
        </label>
        <textarea
          rows={4}
          autoFocus
          placeholder="Explain why this action is being cancelled…"
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          maxLength={1000}
          className="w-full px-4 py-3 text-sm outline-none resize-none"
          style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
            backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#C62828'; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(229, 57, 53, 0.25)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
        />
        <p className="text-xs text-right mt-1" style={{ color: '#888888' }}>{cancelReason.length}/1000</p>

        {cancelError && (
          <div className="p-3 text-xs mt-3" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>
            {cancelError}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setCancelTarget(null)}
            className="flex-1 px-4 py-2.5 text-sm font-medium border transition-colors"
            style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Go Back
          </button>
          <button
            onClick={confirmCancel}
            disabled={cancelSubmitting || !cancelReason.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#C62828', fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { if (!cancelSubmitting && cancelReason.trim()) e.currentTarget.style.backgroundColor = '#b71c1c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#C62828'; }}
            onMouseDown={(e) => { if (!cancelSubmitting) e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <FiSlash className="w-4 h-4" />
            {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
