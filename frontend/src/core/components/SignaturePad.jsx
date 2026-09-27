import { useState, useEffect, useRef } from 'react';

// Shared freehand signature pad; reports a PNG data URL through onChange ('' once cleared)

const PRIMARY = '#056daa';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e) => {
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* not supported for this pointer */ }
    drawingRef.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    // dot for a single tap
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    if (!hasInkRef.current) { hasInkRef.current = true; setHasInk(true); }
  };

  const handleMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasInkRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasInkRef.current = false;
    setHasInk(false);
    onChange('');
  };

  return (
    <div className="space-y-1.5">
      <div className="relative bg-white" style={{ border: `1px solid ${BORDER}` }}>
        <canvas
          ref={canvasRef}
          className="w-full h-36 block cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {!hasInk && (
          <span className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none select-none" style={{ color: '#C9C9C9' }}>
            Sign here
          </span>
        )}
      </div>
      {hasInk && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium cursor-pointer"
          style={{ color: PRIMARY, fontFamily: fontHeading }}
        >
          Clear signature
        </button>
      )}
    </div>
  );
}
