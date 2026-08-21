import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const DesignUploadContext = createContext(null);

/**
 * Tracks every content-block file (File/Image design components) currently
 * mid-upload while the form is being built, so the Review/Publish flow -
 * which lives in a sibling component, not a parent of the field being
 * edited - can hold off until every one of them has actually finished and
 * become a real URL. Without this, clicking Publish the instant after
 * picking a file could save the schema before that file's upload_id ever
 * resolves, leaving the block pointing at nothing.
 */
export function DesignUploadProvider({ children }) {
  const [progress_by_id, setProgressById] = useState({});

  const register_progress = useCallback((upload_id, percent) => {
    setProgressById((previous) => Object.assign({}, previous, { [upload_id]: percent }));
  }, []);

  const clear_progress = useCallback((upload_id) => {
    setProgressById((previous) => {
      if (!(upload_id in previous)) return previous;
      const next = Object.assign({}, previous);
      delete next[upload_id];
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const percents = Object.values(progress_by_id);
    const is_uploading = percents.length > 0;
    const average_percent = is_uploading ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : 100;
    return { register_progress, clear_progress, is_uploading, average_percent };
  }, [progress_by_id, register_progress, clear_progress]);

  return <DesignUploadContext.Provider value={value}>{children}</DesignUploadContext.Provider>;
}

const NO_PROVIDER_FALLBACK = {
  register_progress: () => {},
  clear_progress: () => {},
  is_uploading: false,
  average_percent: 100,
};

export function useDesignUpload() {
  const context = useContext(DesignUploadContext);
  return context || NO_PROVIDER_FALLBACK;
}
