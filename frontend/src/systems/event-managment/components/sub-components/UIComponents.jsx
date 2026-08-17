const PRIMARY = '#056daa';
const PRIMARY_TINT = '#E3F2FD';
const TINT_BORDER = '#9CC7E4';

export function RibbonBtn({ onClick, active, disabled, title, children, wide }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={active ? { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY } : undefined}
      className={[
        'inline-flex items-center justify-center h-7 rounded-none text-[13px] leading-none gap-1 cursor-pointer',
        'text-[#333333] border border-transparent',
        'hover:bg-[#E3F2FD] hover:border-[#9CC7E4]',
        'active:bg-[#cfe7f8] transition-colors select-none',
        wide ? 'px-2' : 'w-7',
        disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:border-transparent' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function RibbonSelect({ value, onChange, title, width = 'w-32', children, onPreview }) {
  const handleHover = (e) => {
    if (onPreview) {
      const value = e.target.value;
      onPreview(value);
    }
  };

  const handleMouseLeave = () => {
    if (onPreview) {
      onPreview(null);
    }
  };

  return (
    <select
      title={title}
      value={value}
      onChange={onChange}
      onMouseOver={handleHover}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => e.stopPropagation()}
      className={`${width} h-7 px-1 text-[13px] text-[#333333] bg-white border rounded-none focus:outline-none cursor-pointer`}
      style={{ borderColor: '#E0E0E0' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
    >
      {children}
    </select>
  );
}

export function Divider() {
  return <div className="w-px h-9 mx-1" style={{ backgroundColor: '#E0E0E0' }} />;
}

export function GroupLabel({ children }) {
  return (
    <div
      className="text-[10px] text-center mt-1 tracking-tight"
      style={{ color: '#9E9E9E', fontFamily: "'Montserrat', sans-serif" }}
    >
      {children}
    </div>
  );
}

export { PRIMARY, PRIMARY_TINT, TINT_BORDER };
