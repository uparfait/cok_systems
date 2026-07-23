import { STATUS_META } from './TaskDesignTokens';

export default function TaskBadge({ status }) {
  const m = STATUS_META[status] || { header: '#9E9E9E', text: '#6B7280', light: '#F3F4F6', border: '#E5E7EB', bg: '#F3F4F6' };
  const Icon = m.icon;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: 0, fontSize: '12px', fontWeight: 600, border: `1px solid ${m.border}`, backgroundColor: m.light, color: m.text, fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.3px' }}>
      {Icon && <Icon style={{ width: '12px', height: '12px' }} />} {status}
    </span>
  );
}
