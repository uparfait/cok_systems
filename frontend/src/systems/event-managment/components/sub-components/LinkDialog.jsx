import { useState, useRef } from 'react';

export default function LinkDialog({ onClose, onSubmit }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const dialogRef = useRef(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const handleMouseDown = (e) => {
    if (dragRef.current && dragRef.current.contains(e.target)) {
      setIsDragging(true);
      const startX = e.clientX - position.x;
      const startY = e.clientY - position.y;

      const handleMouseMove = (e) => {
        setPosition({
          x: e.clientX - startX,
          y: e.clientY - startY,
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
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
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 bg-white border border-[#c7c7c7] rounded-lg shadow-xl p-4 w-80"
    >
      <div
        ref={dragRef}
        onMouseDown={handleMouseDown}
        className="bg-[#185abd] text-white px-3 py-2 rounded-t-lg flex justify-between items-center cursor-move -m-4 mb-3"
      >
        <span className="text-sm font-medium">Insert Link</span>
        <button onClick={onClose} className="text-white hover:text-gray-200">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Text to display</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Link text"
            className="w-full px-2 py-1 text-sm border border-[#c7c7c7] rounded focus:outline-none focus:border-[#2b7cd3]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Address</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-2 py-1 text-sm border border-[#c7c7c7] rounded focus:outline-none focus:border-[#2b7cd3]"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 text-sm bg-[#185abd] text-white rounded hover:bg-[#1349a0]"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}