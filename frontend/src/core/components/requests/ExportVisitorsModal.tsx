import { useState, useCallback, useRef } from 'react';
import { FiX, FiDownload, FiMove } from 'react-icons/fi';
import { serviceDeliveryService } from '../../../core/services/adminService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const VEHICLE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'with_vehicle', label: 'With Vehicle' },
  { value: 'without_vehicle', label: 'Without Vehicle' },
];

const ALL_FIELDS = [
  { key: 'identification', label: 'Identification' },
  { key: 'identification_type', label: 'Identification Type' },
  { key: 'plate_number', label: 'Plate Number' },
  { key: 'full_name', label: 'Full Name' },
  { key: 'telephone', label: 'Telephone' },
  { key: 'email', label: 'Email' },
  { key: 'gender', label: 'Gender' },
  { key: 'date', label: 'Date' },
  { key: 'departments_assigned', label: 'Oriented To' },
  { key: 'from_hour', label: 'From (Hour)' },
  { key: 'to_hour', label: 'To (Hour)' },
  { key: 'duration', label: 'Duration' },
];

const DRAG_ANIMATION_DURATION = 200;

const ExportVisitorsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'year' | 'range'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicle, setVehicle] = useState<'all' | 'with_vehicle' | 'without_vehicle'>('all');
  const [fields, setFields] = useState<string[]>(ALL_FIELDS.map(f => f.key));
  const [title, setTitle] = useState('Visitors Data Report');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const toggleField = useCallback((key: string) => {
    setFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  }, []);

  const reorderFields = useCallback((fromIndex: number, toIndex: number) => {
    setFields(prev => {
      const newFields = [...prev];
      const [moved] = newFields.splice(fromIndex, 1);
      newFields.splice(toIndex, 0, moved);
      return newFields;
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setDropIndex(null);
    dragItemRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItemRef.current !== null && dragItemRef.current !== index) {
      setDropIndex(index);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragItemRef.current;
    setDragIndex(null);
    setDropIndex(null);
    if (fromIndex !== null && fromIndex !== dropIndex) {
      setAnimatingIndex(dropIndex);
      reorderFields(fromIndex, dropIndex);
      setTimeout(() => {
        setAnimatingIndex(null);
      }, DRAG_ANIMATION_DURATION);
    }
    dragItemRef.current = null;
  }, [reorderFields]);

  const handleDragLeave = useCallback(() => {
    setDropIndex(null);
  }, []);

  const handleVehicleChange = useCallback((value: string) => {
    setVehicle(value as any);
    if (value === 'with_vehicle') {
      setFields(prev => prev.includes('plate_number') ? prev : [...prev, 'plate_number']);
    } else if (value === 'without_vehicle') {
      setFields(prev => prev.filter(f => f !== 'plate_number'));
    }
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const exportUrl = serviceDeliveryService.exportVisitors({
        period,
        from: from || undefined,
        to: to || undefined,
        vehicle: vehicle !== 'all' ? vehicle : undefined,
        title,
        fields,
      });

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const response = await fetch(exportUrl, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!response.ok) {
        let errorMessage = `Export failed: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // use default error message
        }
        throw new Error(errorMessage);
      }

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
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err?.message || 'Failed to generate report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Export Visitors Data</h3>
          <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
            <FiX className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              placeholder="Enter report title"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {period === 'range' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="cok-auth-input flex-1 py-2.5 px-3 text-sm"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="cok-auth-input flex-1 py-2.5 px-3 text-sm"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Vehicle Filter Only</label>
              <select
                value={vehicle}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {VEHICLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>Columns to Include</label>
            <div className="space-y-1">
              {fields.map((fieldKey, fieldsIndex) => {
                const fieldDef = ALL_FIELDS.find(f => f.key === fieldKey);
                if (!fieldDef) return null;
                const isDragging = dragIndex === fieldsIndex;
                const isDropTarget = dropIndex === fieldsIndex;
                const isAnimating = animatingIndex === fieldsIndex;
                return (
                  <div
                    key={fieldKey}
                    draggable
                    onDragStart={(e) => handleDragStart(e, fieldsIndex)}
                    onDragOver={(e) => handleDragOver(e, fieldsIndex)}
                    onDrop={(e) => handleDrop(e, fieldsIndex)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 transition-all duration-200"
                    style={{
                      borderRadius: 0,
                      backgroundColor: isDragging ? '#BBDEFB' : isDropTarget ? '#E3F2FD' : '#F7F9FB',
                      opacity: 1,
                      cursor: 'grab',
                      transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isDragging ? '0 4px 12px rgba(5,109,170,0.3)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <FiMove className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleField(fieldKey)}
                      className="w-4 h-4 flex-shrink-0"
                      style={{ accentColor: '#056daa' }}
                    />
                    <span className="text-xs sm:text-sm flex-1" style={{ color: '#333333' }}>{fieldDef.label}</span>
                    <button
                      type="button"
                      onClick={() => reorderFields(fieldsIndex, fieldsIndex - 1)}
                      disabled={fieldsIndex === 0}
                      className="p-1 text-gray-400 hover:text-[#056daa] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderFields(fieldsIndex, fieldsIndex + 1)}
                      disabled={fieldsIndex === fields.length - 1}
                      className="p-1 text-gray-400 hover:text-[#056daa] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                );
              })}
              {ALL_FIELDS.filter(f => !fields.includes(f.key)).map((fieldDef) => (
                <div
                  key={fieldDef.key}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 transition-all duration-200"
                  style={{
                    borderRadius: 0,
                    backgroundColor: '#FFFFFF',
                    opacity: 0.5,
                    cursor: 'default',
                  }}
                >
                  <FiMove className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleField(fieldDef.key)}
                    className="w-4 h-4 flex-shrink-0"
                    style={{ accentColor: '#056daa' }}
                  />
                  <span className="text-xs sm:text-sm flex-1 text-gray-400" style={{ color: '#333333' }}>{fieldDef.label}</span>
                </div>
              ))}
            </div>
            {fields.length === 0 && (
              <p className="text-xs text-red-500 mt-1">At least one column must be selected</p>
            )}
          </div>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200" style={{ borderRadius: 0 }}>
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={downloading}
              className="cok-btn-outlined flex-1"
              style={{ padding: '0.7rem 1.2rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={fields.length === 0 || downloading}
              className="cok-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ padding: '0.7rem 1.2rem' }}
            >
              {downloading ? (
                <>
                  <SpiralLoader color="#FFFFFF" />
                  Generating...
                </>
              ) : (
                <>
                  <FiDownload className="w-4 h-4" />
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

export default ExportVisitorsModal;