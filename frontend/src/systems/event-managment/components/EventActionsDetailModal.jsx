import { useState } from 'react';

const PRIMARY = '#056daa';

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

const docUrl = (url) => {
  if (!url) return '';
  return url.startsWith('/uploads') ? `/cok/api/v1${url}` : url;
};

export default function EventActionsDetailModal({ detailAction, setDetailAction, setViewingDoc, openCancel }) {
  const [viewingDoc, setViewingDocLocal] = useState(null);

  if (!detailAction) return null;

  const handleViewDoc = (doc) => {
    const resolved = { ...doc, url: docUrl(doc.url) };
    setViewingDocLocal(resolved);
    setViewingDoc?.(resolved);
  };

  const entryDocs = (h) =>
    (h.documents && h.documents.length > 0) ? h.documents : (h.document?.url ? [h.document] : []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" style={{ borderRadius: 0, border: '1px solid #E0E0E0' }}>
        <div className="flex items-start gap-3 px-6 py-4 border-b shrink-0" style={{ borderColor: '#E0E0E0' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>{detailAction.title}</h2>
          </div>
          <StatusBadge status={detailAction.currentStatus?.status} />
          <button
            onClick={() => setDetailAction(null)}
            className="text-xs font-semibold uppercase shrink-0 cursor-pointer"
            style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif", background: 'transparent', border: 0 }}
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <div className="p-3 border" style={{ backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Current Status</p>
            <StatusBadge status={detailAction.currentStatus?.status} />
            {detailAction.currentStatus?.description && (
              <p className="text-sm mt-2" style={{ color: '#333333' }}>{detailAction.currentStatus.description}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Status History
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
                      {h.changedBy?.name && (
                        <span className="text-xs" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>
                          by <span style={{ color: '#333333' }}>{h.changedBy.name}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600">{h.description}</p>
                    {entryDocs(h).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entryDocs(h).map((doc, di) => (
                          <button
                            key={di}
                            onClick={() => handleViewDoc(doc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer hover:bg-[#E3F2FD]"
                            style={{ borderColor: '#E0E0E0', color: PRIMARY }}
                          >
                            <span className="truncate max-w-[180px]">{doc.originalName || doc.filename || 'Document'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-center py-4 italic" style={{ color: '#AAAAAA' }}>No history recorded yet.</p>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-t shrink-0 flex justify-end" style={{ borderColor: '#E0E0E0' }}>
          <button onClick={() => setDetailAction(null)} className="cok-btn-outlined">
            Close
          </button>
        </div>
      </div>

      {viewingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl max-h-[92vh]" style={{ borderRadius: 0 }}>
            <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: '#E0E0E0' }}>
              <span className="text-sm font-semibold text-zinc-800 truncate flex-1">{viewingDoc.originalName || viewingDoc.filename || 'Document'}</span>
              <a href={viewingDoc.url} download={viewingDoc.originalName || viewingDoc.filename} className="px-3 py-1.5 text-xs font-medium border transition-colors" style={{ borderColor: '#E0E0E0', color: '#333333' }}>
                Download
              </a>
              <button
                onClick={() => { setViewingDocLocal(null); setViewingDoc?.(null); }}
                className="text-xs font-semibold uppercase cursor-pointer"
                style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif", background: 'transparent', border: 0 }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-0">
              {viewingDoc.mimetype?.startsWith('image/') ? (
                <img src={viewingDoc.url} alt="" className="max-w-full max-h-full object-contain" />
              ) : viewingDoc.mimetype === 'application/pdf' ? (
                <iframe src={viewingDoc.url} title="" className="w-full h-full border-0" style={{ minHeight: '70vh' }} />
              ) : (
                <div className="text-center p-10">
                  <p className="text-sm font-medium text-zinc-700 mb-1">{viewingDoc.originalName || viewingDoc.filename}</p>
                  <p className="text-xs mb-5" style={{ color: '#888888' }}>This file type cannot be previewed in the browser.</p>
                  <a href={viewingDoc.url} download={viewingDoc.originalName || viewingDoc.filename} className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold transition-colors" style={{ backgroundColor: PRIMARY }}>
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
