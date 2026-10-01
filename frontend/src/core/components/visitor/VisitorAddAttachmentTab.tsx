import React, { useRef, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import { failureOf, formatSize, visitorApi } from './visitorApi';

interface Row {
  key: number;
  file: File | null;
  description: string;
}

interface VisitorAddAttachmentTabProps {
  visitorId: string;
  canAdd: boolean;
  onUploaded: () => void;
  setBusy: (busy: boolean) => void;
}

const VisitorAddAttachmentTab: React.FC<VisitorAddAttachmentTabProps> = ({ visitorId, canAdd, onUploaded, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const counter = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, file: null, description: '' }]);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  if (!canAdd) {
    return <p className="text-sm text-gray-500">This person has no visit yet, so there is nothing to attach files to.</p>;
  }

  const uploading = progress !== null;
  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((list) => [...list, { key: counter.current++, file: null, description: '' }]);
  const removeRow = (key: number) => setRows((list) => (list.length === 1 ? list : list.filter((r) => r.key !== key)));

  const addFiles = (key: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const [first, ...rest] = Array.from(files);
    setRows((list) => {
      const next = list.map((r) => (r.key === key ? { ...r, file: first } : r));
      return [...next, ...rest.map((file) => ({ key: counter.current++, file, description: '' }))];
    });
  };

  const submit = async () => {
    const found: Record<number, string> = {};
    rows.forEach((r) => {
      if (!r.file) found[r.key] = 'Choose a file';
      else if (!r.description.trim()) found[r.key] = 'Add a description';
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setProgress(0);
    setBusy(true);
    try {
      const response = await visitorApi.addAttachments(
        visitorId,
        rows.map((r) => ({ file: r.file as File, description: r.description.trim() })),
        (percent) => setProgress(percent),
      );
      showSuccess(response?.message || 'Attachments added');
      setRows([{ key: counter.current++, file: null, description: '' }]);
      onUploaded();
    } catch (error) {
      showError(failureOf(error).message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const total = rows.reduce((sum, r) => sum + (r.file ? r.file.size : 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500">Add any number of files of any type and size. Every file needs a description.</p>
      {rows.map((row, index) => (
        <div key={row.key} className="border border-gray-200 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">File {index + 1}</span>
            {rows.length > 1 ? (
              <button type="button" aria-label="Remove this file" title="Remove this file" disabled={uploading} onClick={() => removeRow(row.key)} className="text-red-600 hover:text-red-700 disabled:opacity-40 cursor-pointer">
                <FiTrash2 className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 cok-req">File</label>
              <input type="file" multiple disabled={uploading} onChange={(e) => addFiles(row.key, e.target.files)} className="w-full text-sm border border-gray-300 px-2 py-1.5 bg-white" />
              {row.file ? <p className="text-xs text-gray-500 mt-1 truncate">{row.file.name} ({formatSize(row.file.size)})</p> : null}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 cok-req">Description</label>
              <textarea
                rows={2}
                disabled={uploading}
                value={row.description}
                onChange={(e) => update(row.key, { description: e.target.value })}
                placeholder="What is this file?"
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          {errors[row.key] ? <p className="text-xs text-red-600">{errors[row.key]}</p> : null}
        </div>
      ))}

      {uploading ? (
        <div className="flex flex-col gap-1">
          <div className="h-2 bg-gray-100 overflow-hidden"><div className="h-full bg-[#056daa] transition-all" style={{ width: `${progress}%` }} /></div>
          <span className="text-xs text-gray-600">Uploading {progress}% of {formatSize(total)}. Please keep this window open.</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="cok-btn-outlined" disabled={uploading} onClick={addRow}>+ Add another file</button>
        <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={uploading} onClick={submit}>
          {uploading ? 'Uploading...' : `Upload ${rows.length} ${rows.length === 1 ? 'file' : 'files'}`}
        </button>
      </div>
    </div>
  );
};

export default VisitorAddAttachmentTab;
