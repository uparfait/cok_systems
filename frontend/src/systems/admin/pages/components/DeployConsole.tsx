import React, { useEffect, useLayoutEffect, useRef } from 'react';

const fontMono = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

interface DeployConsoleProps {
  text: string;
  /** Shown in place of the output before anything has been run. */
  placeholder: string;
  running: boolean;
}

/**
 * The deployment's own console. Plain black, monospace, and it follows the
 * output as it arrives - but only while the reader is already at the
 * bottom. Scrolling up to read something is how somebody looks at an error
 * that has just gone past, and yanking them back down every time another
 * line lands would make that impossible.
 */
const DeployConsole: React.FC<DeployConsoleProps> = ({ text, placeholder, running }) => {
  const box_ref = useRef<HTMLDivElement | null>(null);
  const stick_to_bottom_ref = useRef(true);

  const handle_scroll = () => {
    const box = box_ref.current;
    if (!box) return;
    // A small tolerance: "at the bottom" should survive sub-pixel rounding
    // and the line that is being written right now.
    stick_to_bottom_ref.current = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  };

  // Laid out before the browser paints, so the view never flashes the old
  // position and then jumps.
  useLayoutEffect(() => {
    const box = box_ref.current;
    if (!box || !stick_to_bottom_ref.current) return;
    box.scrollTop = box.scrollHeight;
  }, [text]);

  useEffect(() => {
    if (running) stick_to_bottom_ref.current = true;
  }, [running]);

  return (
    <div
      ref={box_ref}
      onScroll={handle_scroll}
      role="log"
      aria-live="polite"
      aria-label="Deployment output"
      style={{
        backgroundColor: '#0B0F14',
        color: '#D7E0EA',
        fontFamily: fontMono,
        fontSize: 12.5,
        lineHeight: 1.55,
        padding: '16px 18px',
        borderRadius: 10,
        border: '1px solid #1C2733',
        height: 'clamp(320px, 52vh, 620px)',
        overflowY: 'auto',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {text ? (
        <>
          {text}
          {running && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 8,
                height: 15,
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                backgroundColor: '#4CAF50',
                animation: 'deploy-caret 1s step-end infinite',
              }}
            />
          )}
        </>
      ) : (
        <span style={{ color: '#5A6B7C' }}>{placeholder}</span>
      )}
      <style>{'@keyframes deploy-caret { 50% { opacity: 0; } }'}</style>
    </div>
  );
};

export default DeployConsole;
