export function RibbonBtn({ onClick, active, disabled, title, children, wide }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'inline-flex items-center justify-center h-7 rounded-[3px] text-[13px] leading-none gap-1',
        'text-slate-800 hover:bg-[#e6f0fb] hover:border-[#a8c5e8] border border-transparent',
        'active:bg-[#cfe2f7] transition-colors select-none',
        wide ? 'px-2' : 'w-7',
        active ? 'bg-[#cfe2f7] border-[#7aa9da]' : '',
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
      className={`${width} h-7 px-1 text-[13px] text-slate-800 bg-white border border-[#c7c7c7] rounded-[2px] hover:border-[#7aa9da] focus:outline-none focus:border-[#2b7cd3]`}
    >
      {children}
    </select>
  );
}

export function Divider() {
  return <div className="w-px h-9 bg-[#d4d4d4] mx-1" />;
}

export function GroupLabel({ children }) {
  return (
    <div className="text-[10px] text-slate-500 text-center mt-1 tracking-tight">{children}</div>
  );
}