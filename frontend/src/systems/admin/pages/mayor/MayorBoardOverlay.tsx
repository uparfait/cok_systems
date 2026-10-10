import React, { useEffect, useRef } from 'react';
import OverlayCloseButton from '../../../../core/components/overlay/OverlayCloseButton';

type BoardOverlayWidth = 'md' | 'lg' | 'xl';

const WIDTHS: Record<BoardOverlayWidth, string> = {
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

interface MayorBoardOverlayProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  width?: BoardOverlayWidth;
  children?: React.ReactNode;
}

const MayorBoardOverlay: React.FC<MayorBoardOverlayProps> = ({ title, subtitle, onClose, width = 'lg', children }) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={{ zIndex: 1000, backgroundColor: 'rgba(17, 24, 39, 0.38)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white border border-gray-200 w-full ${WIDTHS[width]} flex flex-col shadow-xl`}
        style={{ maxHeight: 'calc(100vh - 24px)', borderRadius: 0 }}
      >
        <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {title}
            </h2>
            {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
          </div>
          <OverlayCloseButton onClick={() => closeRef.current()} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

export default MayorBoardOverlay;
