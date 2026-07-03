import { useState, useEffect } from 'react';

const LiveTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    const update = () => setElapsed(Math.max(0, Math.floor((new Date().getTime() - start) / 1000)));
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [startTime]);
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return <span className="font-mono tracking-widest">{h}:{m}:{s}</span>;
};

export default LiveTimer;