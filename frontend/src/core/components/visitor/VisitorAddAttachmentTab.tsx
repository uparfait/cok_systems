import React, { useRef, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import { failureOf, formatSize, visitorApi } from './visitorApi';

interface Slot {
  key: number;
  file: File | null;
}

interface VisitorAddAttachmentTabProps {
  visitorId: string;
  canAdd: boolean;
  onUploaded: () => void;
  setBusy: (busy: boolean) => void;
}

const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1';
const FILE_INPUT = 'w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#056daa]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#056daa] file:cursor-pointer cursor-pointer';

const VisitorAddAttachmentTab: React.FC<VisitorAddAttachmentTabProps> = ({ visitorId, canAdd, onUploaded, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const counter = useRef(1);
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<Slot[]>([{ key: 0, file: null }]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!canAdd) {
    return <p className="text-sm text-gray-500">This person has no visit yet, so there is nothing to attach files to.</p>;
  }

  const saving = progress !== null;
  const chosen = slots.filter((s) => s.file).map((s) => s.file as File);
  const totalSize = chosen.reduce((sum, f) => sum + f.size, 0);

  const setFile = (key: number, file: File | null) => setSlots((list) => list.map((s) => (s.key === key ? { ...s, file } : s)));
  const addSlot = () => setSlots((list) => [...list, { key: counter.current++, file: null }]);
  const removeSlot = (key: number) => setSlots((list) => (list.length === 1 ? [{ key: counter.current++, file: null }] : list.filter((s) => s.key !== key)));

  const save = async () => {
    if (saving) return;
    if (!description.trim()) {
      setError('Add a description');
      return;
    }
    if (chosen.length === 0) {
      setError('Choose at least one file');
      return;
    }
    setError('');
    setProgress(0);
    setBusy(true);
    try {
      const response = await visitorApi.addAttachments(visitorId, description.trim(), chosen, setProgress);
      showSuccess(response?.message || 'Files saved');
      setDescription('');
      setSlots([{ key: counter.current++, file: null }]);
      onUploaded();
    } catch (failure) {
      showError(failureOf(failure).message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const status = !saving ? 'Save' : progress < 100 ? `Uploading ${chosen.length} ${chosen.length === 1 ? 'file' : 'files'}, ${progress}%` : 'Saving...';

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <label className="cok-auth-label cok-req">Description</label>
        <textarea
          rows={3}
          value={description}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are these files about?"
          className="cok-auth-input w-full py-2.5 px-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={`${LABEL} cok-req`}>Files</label>
        {slots.map((slot) => (
          <div key={slot.key} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <input type="file" disabled={saving} onChange={(e) => setFile(slot.key, e.target.files && e.target.files[0] ? e.target.files[0] : null)} className={FILE_INPUT} />
              {slot.file ? <p className="mt-1 truncate text-xs text-gray-500">{formatSize(slot.file.size)}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              disabled={saving}
              onClick={() => removeSlot(slot.key)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="cok-btn-outlined w-auto! px-4! py-1.5! text-xs! rounded-md!" disabled={saving} onClick={addSlot}>Add</button>
        </div>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {saving ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#056daa] transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'file' : 'files'}, ${formatSize(totalSize)}` : ''}</span>
        <button type="button" className="cok-btn-primary w-auto! px-6! rounded-md! inline-flex items-center gap-2 disabled:opacity-60" disabled={saving} onClick={save}>
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
          {status}
        </button>
      </div>
    </div>
  );
};

export default VisitorAddAttachmentTab;
