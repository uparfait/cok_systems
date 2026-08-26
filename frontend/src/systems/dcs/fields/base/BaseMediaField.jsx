import React, { useRef, useState, useEffect, useMemo } from "react";
import { get_field_text } from "../fieldText.js";
import { file_extension_allowed } from "../fileTypeGroups.js";
import { get_max_size_bytes } from "../fileSizeLimit.js";
import { useMediaUpload } from "../../renderer/MediaUploadContext.jsx";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFileViewerModal from "../../components/DcsFileViewerModal.jsx";

/**
 * Shared rendering for every media capture/upload field (image, video,
 * audio, generic file upload) - a translated trigger button, drag-and-drop,
 * the accepted file types, a size guard, a live upload percentage, and -
 * once something is picked - a filename with a View and a Remove control.
 * Every file is uploaded to disk storage the moment it's picked (never
 * embedded as base64) - value only ever holds {name, type, size, url}, a
 * respondent-pasted link ({..., is_link: true}), or - while offline, or if
 * the upload attempt itself failed - a not-yet-uploaded
 * {..., pending_file, status: "pending_upload"} that the sync loop finishes
 * uploading later. What was picked is never rendered full-size in place;
 * View opens it in the same popup viewer used everywhere else, on demand.
 */
export default function BaseMediaField({ field, language, mode, value, onChange, error, accept, capture, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const media_upload = useMediaUpload();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);
  const [type_not_allowed, setTypeNotAllowed] = useState(false);
  const [size_exceeded, setSizeExceeded] = useState(false);
  const [upload_failed, setUploadFailed] = useState(false);
  const [is_uploading, setIsUploading] = useState(false);
  const [upload_percent, setUploadPercent] = useState(0);
  const [is_deleting_old, setIsDeletingOld] = useState(false);
  const [is_viewer_open, setIsViewerOpen] = useState(false);
  const [is_link_mode, setIsLinkMode] = useState(false);
  const [link_value, setLinkValue] = useState("");

  const is_pending_upload = !!value && value.status === "pending_upload";
  const is_busy = is_uploading || is_deleting_old;

  // Whatever is currently answered is about to be replaced or cleared -
  // deleted from disk first (only ever our own uploaded URL - a pasted
  // link or a still-local pending file has nothing on the server to clean
  // up), so refilling this field over and over never leaves a trail of
  // orphaned files behind.
  const delete_previous_file = async () => {
    if (!value || !value.url) return;
    setIsDeletingOld(true);
    try {
      await media_upload.delete_file(value.url);
    } finally {
      setIsDeletingOld(false);
    }
  };

  // A file still waiting to upload has no server URL yet - its own raw
  // bytes are the only thing there is to preview or download locally.
  const local_preview_url = useMemo(() => {
    if (!is_pending_upload || !value.pending_file) return null;
    return URL.createObjectURL(value.pending_file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_pending_upload, value && value.pending_file]);
  useEffect(() => () => { if (local_preview_url) URL.revokeObjectURL(local_preview_url); }, [local_preview_url]);

  const attempt_upload = async (file) => {
    setIsUploading(true);
    setUploadPercent(0);
    try {
      const uploaded = await media_upload.upload_file(field.id, file, setUploadPercent);
      onChange({ name: uploaded.name, type: uploaded.type, size: uploaded.size, url: uploaded.url });
    } catch (upload_error) {
      if (upload_error && upload_error.is_network_error) {
        // Offline (or the connection dropped mid-upload) - the file itself
        // is kept, not lost, and the background sync loop will finish
        // uploading it the moment connectivity comes back.
        onChange({ name: file.name, type: file.type, size: file.size, pending_file: file, status: "pending_upload" });
      } else {
        setUploadFailed(true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const apply_selected_file = async (file) => {
    if (!file || !onChange) return;
    setUploadFailed(false);
    setTypeNotAllowed(false);
    setSizeExceeded(false);
    const max_bytes = get_max_size_bytes(field);
    if (max_bytes && file.size > max_bytes) {
      setSizeExceeded(true);
      return;
    }
    if (!file_extension_allowed(file.name, field.allowed_file_type_groups)) {
      setTypeNotAllowed(true);
      return;
    }
    await delete_previous_file();
    if (!media_upload.is_online) {
      onChange({ name: file.name, type: file.type, size: file.size, pending_file: file, status: "pending_upload" });
      return;
    }
    await attempt_upload(file);
  };

  const handle_file_selected = (event) => {
    apply_selected_file(event.target.files && event.target.files[0]);
  };

  const handle_drop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    if (is_builder) return;
    apply_selected_file(event.dataTransfer.files && event.dataTransfer.files[0]);
  };

  const handle_remove = async () => {
    setUploadFailed(false);
    setTypeNotAllowed(false);
    setSizeExceeded(false);
    await delete_previous_file();
    if (input_ref.current) input_ref.current.value = "";
    if (onChange) onChange(null);
  };

  const handle_retry_upload = () => {
    if (value && value.pending_file) attempt_upload(value.pending_file);
  };

  const apply_link = async () => {
    if (!link_value.trim() || !onChange) return;
    const next_url = link_value.trim();
    await delete_previous_file();
    onChange({ name: next_url, type: "link", size: null, url: next_url, is_link: true });
    setLinkValue("");
    setIsLinkMode(false);
  };

  const viewer_url = is_pending_upload ? local_preview_url : value && value.url;

  return (
    <div
      className="w-full"
      onDragOver={(event) => {
        if (is_builder) return;
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handle_drop}
      style={is_drag_over ? { backgroundColor: "rgba(5,109,170,0.05)", outline: "2px dashed #056daa" } : undefined}
    >
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>

      {is_link_mode ? (
        <div className="flex flex-col gap-2">
          <input
            className="cok-auth-input w-full py-3"
            placeholder="https://..."
            value={link_value}
            onChange={(event) => setLinkValue(event.target.value)}
          />
          <div className="flex gap-2">
            <DcsButtonOutline disabled={is_busy} onClick={apply_link}>
              {is_deleting_old ? translate("DCS_WAITING_GENERIC") : translate("DCS_BTN_USE_LINK")}
            </DcsButtonOutline>
            <DcsButtonOutline disabled={is_busy} onClick={() => setIsLinkMode(false)}>{translate("DCS_BTN_CANCEL")}</DcsButtonOutline>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={input_ref}
            type="file"
            accept={accept}
            capture={capture}
            className="hidden"
            disabled={is_builder}
            onChange={handle_file_selected}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <DcsButtonOutline disabled={is_builder || is_busy} onClick={() => input_ref.current && input_ref.current.click()}>
              {is_deleting_old
                ? translate("DCS_WAITING_GENERIC")
                : is_uploading
                  ? translate("DCS_UPLOADING_PERCENT", { percent: upload_percent })
                  : translate("DCS_RENDERER_UPLOAD_PROMPT")}
            </DcsButtonOutline>
            {field.allow_link_input && !is_builder && !value && (
              <button type="button" className="text-xs underline cursor-pointer" style={{ color: "#056daa" }} onClick={() => setIsLinkMode(true)}>
                {translate("DCS_BTN_USE_LINK_INSTEAD")}
              </button>
            )}
          </div>
          {!is_builder && !value && (
            <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
              {translate("DCS_DROP_FILE_HINT")}
            </p>
          )}
        </>
      )}

      {type_not_allowed && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_TYPE_NOT_ALLOWED_CLIENT")}
        </p>
      )}
      {size_exceeded && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_TOO_LARGE")}
        </p>
      )}
      {upload_failed && (
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs" style={{ color: "#E74C3C" }}>
            {translate("DCS_FILE_UPLOAD_FAILED")}
          </p>
        </div>
      )}

      {value && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-sm truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }} title={value.name}>
            {value.name}
          </span>
          {is_pending_upload && (
            <span className="text-xs font-semibold px-2 py-0.5" style={{ color: "#FFFFFF", backgroundColor: "#F5A623" }}>
              {translate("DCS_UPLOAD_PENDING_OFFLINE")}
            </span>
          )}
          {is_pending_upload && !is_builder && media_upload.is_online && (
            <button type="button" onClick={handle_retry_upload} className="text-xs underline cursor-pointer" style={{ color: "#056daa" }}>
              {translate("DCS_BTN_RETRY_UPLOAD")}
            </button>
          )}
          {viewer_url && (
            <button
              type="button"
              onClick={() => setIsViewerOpen(true)}
              title={translate("DCS_BTN_VIEW")}
              className="cursor-pointer p-1.5 border flex-shrink-0"
              style={{ borderColor: "#E0E0E0" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
          {is_deleting_old && (
            <span className="text-xs" style={{ color: "#9E9E9E" }}>
              {translate("DCS_WAITING_GENERIC")}
            </span>
          )}
          {!is_builder && (
            <button
              type="button"
              onClick={handle_remove}
              disabled={is_busy}
              title={translate("DCS_BTN_DELETE")}
              className="cursor-pointer p-1.5 border flex-shrink-0"
              style={{ borderColor: "#E0E0E0" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      )}

      {is_viewer_open && viewer_url && (
        <DcsFileViewerModal fileUrl={viewer_url} fileName={value.name} fileType={value.type} onClose={() => setIsViewerOpen(false)} />
      )}

      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
