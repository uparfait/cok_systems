import { FiArrowLeft } from 'react-icons/fi';

export default function TaskTopBar({ onBack, title }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0E0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10 }}>
      <button onClick={onBack} style={{ padding: '8px', borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9E9E9E', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}>
        <FiArrowLeft style={{ width: '20px', height: '20px' }} />
      </button>
      <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#333333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Montserrat', sans-serif" }}>{title}</h1>
    </div>
  );
}
