import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiEdit2, FiExternalLink } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import { failureOf, formatDateTime, formatSize, visitorApi } from './visitorApi';
import type { VisitorAttachmentFile, VisitorAttachmentGroup } from './visitorTypes';

interface VisitorAttachmentsTabProps {
  visitorId: string;
  refreshKey: number;
  setBusy: (busy: boolean) => void;
}

const PAGE = 10;
const ICON_BUTTON = 'flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-[#056daa]/10 hover:text-[#056daa] disabled:opacity-40 cursor-pointer';

const Spinner: React.FC = () => (
  <div className="flex justify-center py-4">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#056daa] border-t-transparent" />
  </div>
);

interface EditorProps {
  visitorId: string;
  group: VisitorAttachmentGroup;
  file: VisitorAttachmentFile;
  setBusy: (busy: boolean) => void;
  onDone: () => void;
}

const FileEditor: React.FC<EditorProps> = ({ visitorId, group, file, setBusy, onDone }) => {
  const { showSuccess, showError } = useToast();
  const [description, setDescription] = useState(group.description);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const saving = progress !== null;

  const save = async () => {
    if (saving) return;
    if (!description.trim()) {
      showError('The description cannot be empty');
      return;
    }
    setProgress(0);
    setBusy(true);
    try {
      await visitorApi.updateAttachment(visitorId, file._id, { description: description.trim(), file: replacement }, setProgress);
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
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <input
        type="text"
        value={description}
        disabled={saving}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#056daa]"
      />
      <input type="file" disabled={saving} onChange={(e) => setReplacement(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#056daa]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#056daa] cursor-pointer" />
      <div className="flex justify-end">
        <button type="button" className="cok-btn-primary w-auto! px-5! py-1.5! text-xs! rounded-md! inline-flex items-center gap-2" disabled={saving} onClick={save}>
          {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
          {saving ? (progress < 100 ? `Uploading ${progress}%` : 'Saving...') : 'Save'}
        </button>
      </div>
    </div>
  );
};

const VisitorAttachmentsTab: React.FC<VisitorAttachmentsTabProps> = ({ visitorId, refreshKey, setBusy }) => {
  const { showError } = useToast();
  const [groups, setGroups] = useState<VisitorAttachmentGroup[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const sequence = useRef(0);

  const loadPage = useCallback(async (next: number, replace: boolean) => {
    const current = ++sequence.current;
    setLoading(true);
    setFailed(false);
    try {
      const response = await visitorApi.attachments(visitorId, next, PAGE);
      if (current !== sequence.current) return;
      setGroups((list) => (replace ? response.data : [...list, ...response.data.filter((g) => !list.some((x) => x.batch === g.batch))]));
      setPage(next);
      setPages(response.pages || 1);
    } catch {
      if (current === sequence.current) setFailed(true);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    setGroups([]);
    setPage(0);
    setPages(1);
    setEditing(null);
    loadPage(1, true);
  }, [loadPage, refreshKey]);

  const hasMore = page > 0 && page < pages;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || failed) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadPage(page + 1, false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, failed, page, loadPage]);

  const open = async (file: VisitorAttachmentFile, download: boolean) => {
    setOpening(file._id);
    try {
      const blob = await visitorApi.downloadAttachment(file._id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.file_name || 'attachment';
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

  if (groups.length === 0 && loading) return <Spinner />;
  if (groups.length === 0 && failed) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        Could not load the attachments. <button type="button" className="text-[#056daa] underline cursor-pointer" onClick={() => loadPage(1, true)}>Retry</button>
      </p>
    );
  }
  if (groups.length === 0) return <p className="text-sm text-gray-500">No attachment has been added for this visitor yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.batch} className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
          <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">{group.description}</p>
          <p className="mt-1 text-xs text-gray-500">
            {group.uploaded_by?.name || 'Unknown'}
            {group.uploaded_by?.department_name ? `, ${group.uploaded_by.department_name}` : ''}
            {' - '}{formatDateTime(group.uploaded_at)}
            {group.visit && !group.visit.is_still_inhouse ? ` - visit of ${formatDateTime(group.visit.entry_date)}` : ''}
          </p>
          <ul className="mt-3 divide-y divide-gray-100">
            {group.files.map((file) => (
              <li key={file._id} className="py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800">{file.file_name}</p>
                    <p className="text-[11px] text-gray-500">{formatSize(file.size)}</p>
                  </div>
                  <button type="button" aria-label="Open" title="Open" className={ICON_BUTTON} disabled={opening === file._id} onClick={() => open(file, false)}>
                    <FiExternalLink className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Download" title="Download" className={ICON_BUTTON} disabled={opening === file._id} onClick={() => open(file, true)}>
                    <FiDownload className="h-4 w-4" />
                  </button>
                  {group.can_edit ? (
                    <button type="button" aria-label="Edit" title="Edit" className={`${ICON_BUTTON} ${editing === file._id ? 'bg-[#056daa]/10 text-[#056daa]' : ''}`} onClick={() => setEditing(editing === file._id ? null : file._id)}>
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {editing === file._id ? (
                  <FileEditor visitorId={visitorId} group={group} file={file} setBusy={setBusy} onDone={() => { setEditing(null); loadPage(1, true); }} />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div ref={sentinel} className="h-1" />
      {loading ? <Spinner /> : null}
      {failed && !loading ? (
        <p className="py-2 text-center text-sm text-gray-500">
          Could not load more. <button type="button" className="text-[#056daa] underline cursor-pointer" onClick={() => loadPage(page + 1, false)}>Retry</button>
        </p>
      ) : null}
    </div>
  );
};

export default VisitorAttachmentsTab;
