import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import outgoingService from '../../../core/services/outgoingService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const ALL_FIELDS = [
  { key: 'reference_number', label: 'Reference Number' },
  { key: 'department_number', label: 'Department Number' },
  { key: 'date_of_reception', label: 'Date of Reception' },
  { key: 'date_of_recording', label: 'Date of Recording' },
  { key: 'destination', label: 'Destination' },
  { key: 'subject', label: 'Subject' },
  { key: 'sign_by', label: 'Sign By' },
];

const OutgoingExportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'range'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fields, setFields] = useState<string[]>(ALL_FIELDS.map(f => f.key));
  const [title, setTitle] = useState('Outgoing Correspondences Report');
  const [downloading, setDownloading] = useState(false);

  const toggleField = (key: string) => {
    setFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = outgoingService.getExportUrl({
        period: period === 'all' ? undefined : period,
        from: from || undefined,
        to: to || undefined,
        title,
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
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setDownloading(false);
    }
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
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="range">Custom Range</option>
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
            <button type="button" onClick={onClose} disabled={downloading} className="cok-btn-outlined flex-1" style={{ padding: '0.7rem 1.2rem' }}>Cancel</button>
            <button onClick={handleDownload} disabled={fields.length === 0 || downloading} className="cok-btn-primary flex-1 flex items-center justify-center gap-2" style={{ padding: '0.7rem 1.2rem' }}>
              {downloading ? (
                <>
                  <SpiralLoader color="#FFFFFF" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutgoingExportModal;
