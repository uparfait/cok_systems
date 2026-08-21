import React, { createContext, useContext, useMemo } from "react";
import { upload_file_with_progress, delete_uploaded_file } from "../services/uploadService.js";

const MediaUploadContext = createContext(null);

/**
 * Gives every media field (image/video/audio/file_upload/signature) a way
 * to upload straight to disk storage without threading form_group_id and
 * version through every field component and every Group/Section nesting
 * layer in between. Set up once at the top of the public form page; the
 * builder's own preview never wraps this, so useMediaUpload() falls back to
 * a context-less shape whose upload_file always rejects - safe because
 * builder mode never actually calls it (its inputs are disabled).
 */
export function MediaUploadProvider({ formGroupId, version, isOnline, children }) {
  const value = useMemo(
    () => ({
      form_group_id: formGroupId,
      version,
      is_online: isOnline,
      upload_file: (field_id, file, onProgress) =>
        upload_file_with_progress(formGroupId, { version, field_id, file, onProgress }),
      delete_file: (url) => delete_uploaded_file(formGroupId, url),
    }),
    [formGroupId, version, isOnline],
  );

  return <MediaUploadContext.Provider value={value}>{children}</MediaUploadContext.Provider>;
}

const NO_PROVIDER_FALLBACK = {
  form_group_id: null,
  version: null,
  is_online: false,
  upload_file: () => Promise.reject(new Error("media_upload_unavailable")),
  delete_file: () => Promise.resolve(),
};

export function useMediaUpload() {
  const context = useContext(MediaUploadContext);
  return context || NO_PROVIDER_FALLBACK;
}
