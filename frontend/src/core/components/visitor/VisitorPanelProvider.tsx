import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import VisitorPanel from './VisitorPanel';

interface VisitorPanelContextValue {
  openVisitor: (visitorId?: string | null) => void;
  closeVisitor: () => void;
}

const VisitorPanelContext = createContext<VisitorPanelContextValue>({
  openVisitor: () => undefined,
  closeVisitor: () => undefined,
});

export const useVisitorPanel = (): VisitorPanelContextValue => useContext(VisitorPanelContext);

export const visitorIdOf = (row: unknown): string | null => {
  const r = (row || {}) as { visitor_id?: string | null; visitor?: { _id?: string } | string | null };
  if (r.visitor_id) return String(r.visitor_id);
  if (r.visitor && typeof r.visitor === 'object' && r.visitor._id) return String(r.visitor._id);
  if (typeof r.visitor === 'string') return r.visitor;
  return null;
};

export const VisitorPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visitorId, setVisitorId] = useState<string | null>(null);

  const openVisitor = useCallback((id?: string | null) => {
    if (id) setVisitorId(String(id));
  }, []);
  const closeVisitor = useCallback(() => setVisitorId(null), []);
  const value = useMemo(() => ({ openVisitor, closeVisitor }), [openVisitor, closeVisitor]);

  return (
    <VisitorPanelContext.Provider value={value}>
      {children}
      {visitorId ? <VisitorPanel key={visitorId} visitorId={visitorId} onClose={closeVisitor} /> : null}
    </VisitorPanelContext.Provider>
  );
};

export default VisitorPanelProvider;
