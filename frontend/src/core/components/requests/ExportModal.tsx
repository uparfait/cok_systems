import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import requestService from '../../../core/services/requestService';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const ALL_FIELDS = [
  { key: 'redaction_date', label: 'Redaction Date' },
  { key: 'reference_number', label: 'Reference Number' },
  { key: 'reception_date', label: 'Reception Date' },
  { key: 'sender', label: 'Sender' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'subject', label: 'Subject' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'remarks', label: 'Remarks' },
];

const ExportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'range'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fields, setFields] = useState<string[]>(ALL_FIELDS.map(f => f.key));
  const [title, setTitle] = useState('Incoming Correspondences Report');

  const toggleField = (key: string) => {
    setFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  };

  const handleDownload = async () => {
    const url = requestService.getExportUrl({
      period: period === 'all' ? undefined : period,
      from: from || undefined,
      to: to || undefined,
      fields: fields.join(','),
      title,
      senderLayout: 'combined',
    });
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const response = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error(`Export failed: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Export Report</h3>
          <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
            <FiX className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Report Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="cok-auth-input w-full py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="cok-auth-input w-full py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {period === 'range' && (
              <div className="flex gap-2 mt-2">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="cok-auth-input flex-1 py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }} />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="cok-auth-input flex-1 py-2.5 px-3 text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Columns to Include</label>
            <div className="flex flex-wrap gap-2">
              {ALL_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 px-3 py-2 cursor-pointer border border-gray-200 hover:bg-gray-50 transition-colors" style={{ borderRadius: 0, backgroundColor: fields.includes(field.key) ? '#F7F9FB' : '#FFFFFF' }}>
                  <input type="checkbox" checked={fields.includes(field.key)} onChange={() => toggleField(field.key)} className="w-4 h-4" style={{ accentColor: '#056daa' }} />
                  <span className="text-xs sm:text-sm" style={{ color: '#333333' }}>{field.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors" style={{ borderRadius: 0, color: '#333333' }}>Cancel</button>
            <button onClick={handleDownload} disabled={fields.length === 0} className="flex-1 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: '#056daa', borderRadius: 0 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
