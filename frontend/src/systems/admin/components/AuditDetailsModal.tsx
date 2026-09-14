import React from 'react';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const fontHeading = "'Montserrat', sans-serif";

export interface AuditRecord {
  _id: string;
  time: string;
  status: number;
  method?: string;
  user_email?: string;
  user_name?: string;
  description?: string;
  message?: string;
  error?: string;
  endpoint?: string;
  ip_address?: string;
  source?: string;
}

interface AuditDetailsModalProps {
  record: AuditRecord | null;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  backend: 'Main system',
  dcs: 'Data Collection System',
  events: 'Event Management',
};

const statusLabel = (status: number) => {
  if (status >= 500) return 'Server error';
  if (status === 401) return 'Login required';
  if (status === 403) return 'Access refused';
  if (status === 404) return 'Not found';
  if (status >= 400) return 'Request rejected';
  if (status >= 300) return 'Redirect';
  return 'Other response';
};

const statusTone = (status: number) => {
  if (status >= 500) return 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]';
  if (status === 401 || status === 403) return 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]';
  if (status >= 400) return 'bg-[rgba(5,109,170,0.1)] text-[#056daa]';
  return 'bg-[rgba(51,51,51,0.08)] text-[#555555]';
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 break-words min-w-0 whitespace-pre-wrap">{value}</span>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-gray-200">
    <div className="px-4 py-2.5 bg-[#F7F9FB] border-b border-gray-200">
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>{title}</h3>
    </div>
    <div className="px-4 py-2 divide-y divide-gray-100">{children}</div>
  </div>
);

const AuditDetailsModal: React.FC<AuditDetailsModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const when = new Date(record.time);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 sm:px-5 py-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: record.status >= 500 ? DANGER : PRIMARY }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-10 bg-white/20 flex items-center justify-center shrink-0">
              <span className="font-bold text-sm" style={{ fontFamily: fontHeading }}>{record.status}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate" style={{ fontFamily: fontHeading }}>{statusLabel(record.status)}</h2>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{record.method || ''} {record.endpoint || ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-white text-white hover:bg-white hover:text-[#333333] transition-colors cursor-pointer shrink-0 text-xs font-semibold uppercase"
            style={{ padding: '0.4rem 1rem', letterSpacing: '1px', fontFamily: fontHeading, borderRadius: 0 }}
            title="Close"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Section title="Request">
            <Row label="Time" value={when.toLocaleString()} />
            <Row label="Method" value={record.method} />
            <Row label="Endpoint" value={record.endpoint} />
            <Row label="System" value={SOURCE_LABELS[record.source || ''] || record.source} />
            <Row label="IP Address" value={record.ip_address} />
          </Section>

          <Section title="User">
            <Row label="Email" value={record.user_email || 'Anonymous (not signed in)'} />
            <Row label="Name" value={record.user_name} />
          </Section>

          <Section title="Response">
            <Row
              label="Status"
              value={
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusTone(record.status)}`}>
                  {record.status} - {statusLabel(record.status)}
                </span>
              }
            />
            <Row label="Description" value={record.description} />
            <Row label="Message Sent To User" value={record.message} />
            <Row label="Actual Error" value={record.error ? <span style={{ color: DANGER }}>{record.error}</span> : ''} />
          </Section>
        </div>
      </div>
    </div>
  );
};

export default AuditDetailsModal;
