import { useState, useRef } from 'react';
import { FiX } from 'react-icons/fi';

const PRIMARY = '#056daa';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

export default function LinkDialog({ onClose, onSubmit }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const dialogRef = useRef(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const dragRef = useRef(null);

  const handleMouseDown = (e) => {
    if (dragRef.current && dragRef.current.contains(e.target)) {
      const startX = e.clientX - position.x;
      const startY = e.clientY - position.y;

      const handleMouseMove = (e) => {
        setPosition({
          x: e.clientX - startX,
          y: e.clientY - startY,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url) {
      onSubmit(url, text);
      onClose();
    }
  };

  return (
    <div
      ref={dialogRef}
      style={{ left: `${position.x}px`, top: `${position.y}px`, border: `1px solid ${BORDER}`, borderRadius: 0 }}
      className="fixed z-50 bg-white shadow-xl w-80 max-w-[calc(100vw-24px)]"
    >
      <div
        ref={dragRef}
        onMouseDown={handleMouseDown}
        className="text-white px-4 py-2.5 flex justify-between items-center cursor-move"
        style={{ backgroundColor: PRIMARY }}
      >
        <span className="text-sm font-bold" style={{ fontFamily: fontHeading }}>Insert Link</span>
        <button type="button" onClick={onClose} className="text-white cursor-pointer hover:opacity-80 p-0.5">
          <FiX className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label
            className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
          >
            Text to display
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Link text"
            className="w-full cok-auth-input pr-3 py-2 text-sm"
            style={{ paddingLeft: '12px' }}
          />
        </div>
        <div>
          <label
            className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
          >
            Address
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full cok-auth-input pr-3 py-2 text-sm"
            style={{ paddingLeft: '12px' }}
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cok-btn-outlined"
            style={{ padding: '0.5rem 1rem' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1.4rem' }}
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
