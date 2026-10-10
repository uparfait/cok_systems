import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import OverlayCloseButton from './OverlayCloseButton';

export type OverlayWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const WIDTHS: Record<OverlayWidth, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[96vw]',
};

const openStack: object[] = [];
let bodyOverflow = '';

export interface OverlayShellProps {
  open?: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  width?: OverlayWidth;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
  closeOnBackdrop?: boolean;
  zIndex?: number;
  bodyClassName?: string;
}

const OverlayShell: React.FC<OverlayShellProps> = ({
  open = true,
  title,
  subtitle,
  onClose,
  busy = false,
  width = 'md',
  footer,
  headerExtra,
  children,
  closeOnBackdrop = true,
  zIndex = 1000,
  bodyClassName = '',
}) => {
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  busyRef.current = busy;
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    openStack.push(token);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openStack[openStack.length - 1] !== token) return;
      if (!busyRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    if (openStack.length === 1) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
      if (openStack.length === 0) document.body.style.overflow = bodyOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const requestClose = () => {
    if (!busyRef.current) closeRef.current();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={{ zIndex, backgroundColor: 'rgba(17, 24, 39, 0.38)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
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
          <OverlayCloseButton onClick={requestClose} disabled={busy} />
        </div>
        {headerExtra}
        <div className={`flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 ${bodyClassName}`}>{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-gray-100">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};

export default OverlayShell;
