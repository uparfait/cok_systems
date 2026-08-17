export default function ContextMenu({ x, y, onAction }) {
  const menuItems = [
    { action: 'cut', label: 'Cut' },
    { action: 'copy', label: 'Copy' },
    { action: 'paste', label: 'Paste', divider: true },
    { action: 'selectAll', label: 'Select All' },
  ];

  return (
    <div
      style={{ left: `${x}px`, top: `${y}px`, border: '1px solid #E0E0E0', borderRadius: 0 }}
      className="fixed z-50 bg-white shadow-xl py-1 min-w-[160px]"
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <div key={item.action}>
          {item.divider && index > 0 && (
            <div className="border-t my-1" style={{ borderColor: '#E0E0E0' }}></div>
          )}
          <button
            onClick={() => onAction(item.action)}
            className="w-full text-left px-4 py-1.5 text-[13px] cursor-pointer hover:bg-[#E3F2FD]"
            style={{ color: '#333333' }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
