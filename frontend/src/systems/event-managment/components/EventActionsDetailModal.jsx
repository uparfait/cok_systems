import { FiX, FiEye, FiSlash, FiActivity, FiPaperclip, FiFileText, FiDownload, FiUser, FiCalendar } from 'react-icons/fi';
import { useState } from 'react';
import SystemAlert from '@/core/components/SystemAlert';

const PRIMARY = '#056daa';
const NEUTRAL_LIGHT = '#F7F9FB';

function StatusBadge({ status }) {
  const STATUS_META = {
    Pending: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
    'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200' },
    Completed: { color: 'bg-green-100 text-green-700 border-green-200' },
    Cancelled: { color: 'bg-red-100 text-red-700 border-red-200' },
  };
  const meta = STATUS_META[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-xs font-medium border ${meta.color}`}>
      {status}
    </span>
  );
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  return status !== 'Completed' && status !== 'Cancelled' && new Date(dueDate) < new Date();
}

export default function EventActionsDetailModal({ detailAction, setDetailAction, eventNameMap, setViewingDoc, openCancel }) {
  const [viewingDoc, setViewingDocLocal] = useState(null);
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: 'success', message: '' });

  if (!detailAction) return null;

  const handleViewDoc = (doc) => {
    setViewingDocLocal(doc);
    setViewingDoc(doc);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" style={{ borderRadius: 0 }}>
        {/* header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b shrink-0" style={{ borderColor: '#E0E0E0' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>{detailAction.title}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {eventNameMap[detailAction.eventSpecialId] || <span className="italic">Loading event name…</span>}
            </p>
          </div>
          <StatusBadge status={detailAction.currentStatus?.status} />
          <button onClick={() => setDetailAction(null)} className="p-1.5 transition-colors shrink-0" style={{ color: '#888888' }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* description */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>Description</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{detailAction.actionDescription}</p>
          </div>

          {/* meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid #E0E0E0' }}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                <FiUser className="w-3 h-3" style={{ color: PRIMARY }} /> Assigned To
              </p>
              <p className="text-sm font-medium text-zinc-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>{detailAction.assignedPerson?.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{detailAction.assignedPerson?.role}</p>
              <p className="text-xs italic" style={{ color: '#AAAAAA' }}>{detailAction.assignedPerson?.institution}</p>
            </div>
            <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid #E0E0E0' }}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                <FiCalendar className="w-3 h-3" style={{ color: PRIMARY }} /> Due Date
              </p>
              <p className={`text-sm font-semibold ${isOverdue(detailAction.dueDate, detailAction.currentStatus?.status) ? 'text-red-600' : 'text-zinc-800'}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {formatDate(detailAction.dueDate)}
              </p>
              {isOverdue(detailAction.dueDate, detailAction.currentStatus?.status) && (
                <span className="mt-1 inline-block bg-red-100 text-red-600 border border-red-200 rounded-none px-2 py-0.5 text-[10px] font-medium">Overdue</span>
              )}
            </div>
          </div>

          {/* current status note */}
          {detailAction.currentStatus?.description && (
            <div className="p-3 border" style={{ backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Current Status Note</p>
              <p className="text-sm" style={{ color: '#333333' }}>{detailAction.currentStatus.description}</p>
            </div>
          )}

          {/* status history timeline */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <FiActivity className="w-3 h-3" /> Status History
            </p>
            {detailAction.statusHistory?.length ? (
              <ol className="relative border-l-2 ml-2 space-y-5" style={{ borderColor: '#E0E0E0' }}>
                {[...detailAction.statusHistory].reverse().map((h, i) => (
                  <li key={i} className="ml-5 relative">
                    <span className="absolute -left-[1.45rem] top-1 w-4 h-4 bg-white border-2 rounded-full" style={{ borderColor: PRIMARY }} />
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StatusBadge status={h.status} />
                      <span className="text-xs" style={{ color: '#888888' }}>
                        {h.changedAt ? new Date(h.changedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">{h.description}</p>
                    {h.document && (
                      <button onClick={() => handleViewDoc(h.document)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium border transition-colors" style={{ borderColor: '#E0E0E0', color: PRIMARY }}>
                        <FiPaperclip className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[180px]">{h.document.originalName || h.document.filename || 'Document'}</span>
                        <FiEye className="w-3 h-3 shrink-0 opacity-60" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-center py-4 italic" style={{ color: '#AAAAAA' }}>No history recorded yet.</p>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="px-4 sm:px-6 py-3 border-t shrink-0 flex flex-wrap justify-between items-center gap-2" style={{ borderColor: '#E0E0E0' }}>
          {detailAction.currentStatus?.status !== 'Cancelled' && (
            <button
              onClick={() => { setDetailAction(null); openCancel(detailAction); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white rounded-none cursor-pointer transition-colors"
              style={{ backgroundColor: '#E74C3C', fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#E74C3C'; }}
            >
              <FiSlash className="w-4 h-4" /> Cancel Action
            </button>
          )}
          <button onClick={() => setDetailAction(null)} className="cok-btn-outlined ml-auto">
            Close
          </button>
        </div>
      </div>

      {viewingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl max-h-[92vh]" style={{ borderRadius: 0 }}>
            <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: '#E0E0E0' }}>
              <FiPaperclip className="w-4 h-4 shrink-0" style={{ color: PRIMARY }} />
              <span className="text-sm font-semibold text-zinc-800 truncate flex-1">{viewingDoc.originalName || viewingDoc.filename || 'Document'}</span>
              <a href={viewingDoc.url} download={viewingDoc.originalName || viewingDoc.filename} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-colors" style={{ borderColor: '#E0E0E0', color: '#333333' }}>
                <FiDownload className="w-3.5 h-3.5" /> Download
              </a>
              <button onClick={() => { setViewingDocLocal(null); setViewingDoc(null); }} className="p-1.5 transition-colors" style={{ color: '#888888' }}>
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-0">
              {viewingDoc.mimetype?.startsWith('image/') ? (
                <img src={viewingDoc.url} alt="" className="max-w-full max-h-full object-contain" />
              ) : viewingDoc.mimetype === 'application/pdf' ? (
                <iframe src={viewingDoc.url} title="" className="w-full h-full border-0" style={{ minHeight: '70vh' }} />
              ) : (
                <div className="text-center p-10">
                  <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#E3F2FD' }}>
                    <FiFileText className="w-8 h-8" style={{ color: PRIMARY }} />
                  </div>
                  <p className="text-sm font-medium text-zinc-700 mb-1">{viewingDoc.originalName || viewingDoc.filename}</p>
                  <p className="text-xs mb-5" style={{ color: '#888888' }}>This file type cannot be previewed in the browser.</p>
                  <a href={viewingDoc.url} download={viewingDoc.originalName || viewingDoc.filename} className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold transition-colors" style={{ backgroundColor: PRIMARY }}>
                    <FiDownload className="w-4 h-4" /> Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SystemAlert
        isOpen={systemAlert.isOpen}
        type={systemAlert.type}
        message={systemAlert.message}
        onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}
