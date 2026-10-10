import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { failureOf, formatDateTime, formatSize, visitorApi } from './visitorApi';
import type { VisitorAttachment } from './visitorTypes';

interface VisitorAttachmentsTabProps {
  visitorId: string;
  refreshKey: number;
  setBusy: (busy: boolean) => void;
}

const AttachmentEditor: React.FC<{ visitorId: string; attachment: VisitorAttachment; onDone: () => void; setBusy: (b: boolean) => void }> = ({ visitorId, attachment, onDone, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const [description, setDescription] = useState(attachment.description);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const save = async () => {
    if (!description.trim()) {
      showError('The description cannot be empty');
      return;
    }
    setProgress(0);
    setBusy(true);
    try {
      await visitorApi.updateAttachment(visitorId, attachment._id, { description: description.trim(), file }, setProgress);
      showSuccess('Attachment updated');
      onDone();
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 border-t border-gray-100 pt-2 flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 cok-req">Description</label>
      <textarea rows={2} value={description} disabled={progress !== null} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm" />
      <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Replace the file (optional)</label>
      <input type="file" disabled={progress !== null} onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="text-sm border border-gray-300 px-2 py-1.5" />
      {progress !== null ? <span className="text-xs text-gray-600">Saving {progress}%</span> : null}
      <div className="flex justify-end">
        <button type="button" className="cok-btn-primary w-auto! px-5!" disabled={progress !== null} onClick={save}>{progress !== null ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
};

const VisitorAttachmentsTab: React.FC<VisitorAttachmentsTabProps> = ({ visitorId, refreshKey, setBusy }) => {
  const { showError } = useToast();
  const [items, setItems] = useState<VisitorAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await visitorApi.attachments(visitorId);
      setItems(response?.data || []);
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const open = async (attachment: VisitorAttachment, download: boolean) => {
    setOpening(attachment._id);
    try {
      const blob = await visitorApi.downloadAttachment(attachment._id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.file_name || 'attachment';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank', 'noopener');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setOpening(null);
    }
  };

  if (loading && items.length === 0) return <p className="text-sm text-gray-500">Loading attachments...</p>;
  if (items.length === 0) return <p className="text-sm text-gray-500">No attachment has been added for this visitor yet.</p>;

  let lastVisit = '';
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const visitKey = item.visit ? item.visit._id : '';
        const showHeading = visitKey !== lastVisit;
        lastVisit = visitKey;
        return (
          <React.Fragment key={item._id}>
            {showHeading && item.visit ? (
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mt-2">
                {item.visit.is_still_inhouse ? 'Current visit' : 'Visit'} of {formatDateTime(item.visit.entry_date)}
              </h4>
            ) : null}
            <div className="border border-gray-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 break-words">{item.file_name}</p>
                  <p className="text-xs text-gray-500">{formatSize(item.size)} - {item.mime_type}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="cok-btn-outlined px-2! py-1!" disabled={opening === item._id} onClick={() => open(item, false)}>Open</button>
                  <button type="button" className="cok-btn-outlined px-2! py-1!" disabled={opening === item._id} onClick={() => open(item, true)}>Download</button>
                  {item.can_edit ? (
                    <button type="button" className="cok-btn-outlined px-2! py-1!" onClick={() => setEditing(editing === item._id ? null : item._id)}>
                      {editing === item._id ? 'Close editor' : 'Edit'}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">{item.description}</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                <span>Added by: <strong>{item.uploaded_by?.name || '-'}</strong></span>
                <span>Department: {item.uploaded_by?.department_name || '-'}</span>
                <span>Email: {item.uploaded_by?.email || '-'}</span>
                <span>Telephone: {item.uploaded_by?.telephone || '-'}</span>
                <span>Added: {formatDateTime(item.uploaded_at)}</span>
                {item.updated_at ? <span>Updated: {formatDateTime(item.updated_at)}</span> : null}
              </div>
              {editing === item._id ? (
                <AttachmentEditor visitorId={visitorId} attachment={item} setBusy={setBusy} onDone={() => { setEditing(null); load(); }} />
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default VisitorAttachmentsTab;
