export default function ContextMenu({ x, y, onAction }) {
  const menuItems = [
    { action: 'cut', label: 'Cut' },
    { action: 'copy', label: 'Copy' },
    { action: 'paste', label: 'Paste', divider: true },
    { action: 'selectAll', label: 'Select All' },
  ];

  return (
    <div
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 bg-white border border-[#c7c7c7] rounded shadow-xl py-1 min-w-[160px]"
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <div key={item.action}>
          {item.divider && index > 0 && (
            <div className="border-t border-[#d4d4d4] my-1"></div>
          )}
          <button
            onClick={() => onAction(item.action)}
            className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-[#e6f0fb] text-slate-800"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}