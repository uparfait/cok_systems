import { FiUser, FiBriefcase, FiMapPin, FiMail } from 'react-icons/fi';
import { PRIMARY, NEUTRAL_DARK } from './TaskDesignTokens';

export default function TaskInfoCard({ label, color, person, extra }) {
  const colors = {
    blue: { bg: '#E6F4F9', border: '#BFDBFE', avatar: '#A5D8FF', avatarText: '#056daa' },
    gray: { bg: '#F7F9FB', border: '#E5E7EB', avatar: '#E5E7EB', avatarText: '#6B7280' },
  };
  const c = colors[color] || colors.gray;

  return (
    <div style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: 0, padding: '16px 20px', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: color === 'blue' ? PRIMARY : '#9E9E9E', marginBottom: '12px', fontFamily: "'Montserrat', sans-serif" }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: c.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 700, color: c.avatarText, fontFamily: "'Montserrat', sans-serif" }}>
          {person?.name?.[0]?.toUpperCase() || <FiUser style={{ width: '16px', height: '16px' }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#333333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{person?.name || '—'}</p>
          {extra}
          {person?.role && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
              <FiBriefcase style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.role}</span>
            </div>
          )}
          {person?.institution && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9E9E9E' }}>
              <FiMapPin style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.institution}</span>
            </div>
          )}
          {person?.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: PRIMARY }}>
              <FiMail style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.email}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
