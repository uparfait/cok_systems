import React, { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiActivity, FiX } from 'react-icons/fi';

interface ActivityFeedProps {
  auditLogs: any[];
}

const EXCLUDED_PATTERN = /parking|smartparking|smart-parking|servicedelivery|service-delivery|service_delivery|visitor/i;
const CREATE_ACTIONS = ['POST', 'CREATE'];
const UPDATE_ACTIONS = ['PUT', 'PATCH', 'UPDATE'];
const DELETE_ACTIONS = ['DELETE'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getRelativeTime = (date: Date | string | undefined): string => {
  if (!date) return 'Recently';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Recently';
    const diff = new Date().getTime() - dateObj.getTime();
    if (diff < 0) return 'Just now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d ago`;
    return dateObj.toLocaleDateString();
  } catch { return 'Recently'; }
};

const getActionMeta = (action: string) => {
  const a = (action || '').toUpperCase();
  if (CREATE_ACTIONS.includes(a)) return { label: 'created', icon: FiPlus, chip: 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' };
  if (UPDATE_ACTIONS.includes(a)) return { label: 'updated', icon: FiEdit2, chip: 'bg-[rgba(5,109,170,0.1)] text-[#056daa]' };
  if (DELETE_ACTIONS.includes(a)) return { label: 'deleted', icon: FiTrash2, chip: 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]' };
  return { label: (action || 'activity').toLowerCase(), icon: FiActivity, chip: 'bg-[rgba(51,51,51,0.08)] text-[#555555]' };
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ auditLogs }) => {
  const [selected, setSelected] = useState<any | null>(null);
  const now = Date.now();

  const activities = (auditLogs || []).filter((log: any) => {
    const action = (log.action || '').toUpperCase();
    if (![...CREATE_ACTIONS, ...UPDATE_ACTIONS, ...DELETE_ACTIONS].includes(action)) return false;
    const haystack = `${log.endpoint || ''} ${log.description || ''}`;
    if (EXCLUDED_PATTERN.test(haystack)) return false;
    const t = log.time ? new Date(log.time).getTime() : NaN;
    return !isNaN(t) && now - t <= WEEK_MS;
  });

  const detailRows = selected ? [
    ['Description', selected.description || '-'],
    ['Action', (selected.action || '-').toUpperCase()],
    ['By', `${selected.user_name || 'System'}${selected.user_email ? ` (${selected.user_email})` : ''}`],
    ['Time', selected.time ? new Date(selected.time).toLocaleString() : '-'],
    ['Method', selected.method || '-'],
    ['Endpoint', selected.endpoint || '-'],
    ['Status Code', selected.status_code || '-'],
    ['IP Address', selected.ip_address || '-'],
    ...(selected.error_message ? [['Error', selected.error_message]] : []),
  ] : [];

  return (
    <div className="bg-white border border-[#E0E0E0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E0E0E0] bg-[#F7F9FB] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
        <span className="text-xs text-gray-400">Last 7 days</span>
      </div>
      <div className="divide-y divide-[#E0E0E0] max-h-80 overflow-y-auto">
        {activities.map((log: any) => {
          const meta = getActionMeta(log.action);
          const Icon = meta.icon;
          return (
            <button key={log._id} type="button" onClick={() => setSelected(log)} className="w-full text-left px-4 py-2.5 hover:bg-[#F7F9FB] transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 flex items-center justify-center shrink-0 ${meta.chip}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium truncate">{log.description || `${log.method || log.action} ${log.endpoint || ''}`}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 ${meta.chip}`}>{meta.label}</span>
                    <span className="text-xs text-gray-500 truncate">{log.user_name || 'System'}</span>
                    <span className="text-xs text-gray-400">{getRelativeTime(log.time)}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {activities.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">No recent activity this week</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ border: '1px solid #E0E0E0' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between sticky top-0" style={{ backgroundColor: '#056daa' }}>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Activity Details</h3>
              <button type="button" onClick={() => setSelected(null)} className="cok-btn-outlined-reverse" style={{ padding: '0.35rem 0.7rem' }}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {detailRows.map(([label, value], idx) => (
                  <tr key={String(label)} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2.5 w-32 border-b border-r border-[#E0E0E0] text-xs font-bold uppercase tracking-wider text-gray-600 align-top">{label}</td>
                    <td className="px-4 py-2.5 border-b border-[#E0E0E0] text-sm text-[#333333] break-words">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
