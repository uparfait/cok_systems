import React, { useRef, useState } from "react";
import { get_field_text } from "../fieldText.js";
import { read_file_as_data_url } from "../fileHelpers.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFileViewerModal from "../../components/DcsFileViewerModal.jsx";

/**
 * Shared rendering for every media capture/upload field (image, video,
 * audio, generic file upload) - a translated trigger button, drag-and-drop,
 * the accepted mime types, a size guard, and - once something is selected -
 * a filename with a View and a Remove control. What was picked is never
 * rendered full-size in place (an embedded player/image at every stage of
 * a long form pushes everything else out of reach); View opens it in the
 * same popup viewer used everywhere else in the system, on demand.
 */
export default function BaseMediaField({ field, language, mode, value, onChange, error, accept, capture, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);
  const [read_failed, setReadFailed] = useState(false);
  const [size_exceeded, setSizeExceeded] = useState(false);
  const [is_viewer_open, setIsViewerOpen] = useState(false);

  const apply_selected_file = async (file) => {
    if (!file || !onChange) return;
    setReadFailed(false);
    setSizeExceeded(false);
    if (field.max_size_mb) {
      const max_bytes = field.max_size_mb * 1024 * 1024;
      if (file.size > max_bytes) {
        setSizeExceeded(true);
        return;
      }
    }
    try {
      const read_result = await read_file_as_data_url(file);
      onChange(read_result);
    } catch (error) {
      setReadFailed(true);
    }
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

  const handle_remove = () => {
    setReadFailed(false);
    setSizeExceeded(false);
    if (input_ref.current) input_ref.current.value = "";
    if (onChange) onChange(null);
  };

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
      <input
        ref={input_ref}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        disabled={is_builder}
        onChange={handle_file_selected}
      />
      <DcsButtonOutline disabled={is_builder} onClick={() => input_ref.current && input_ref.current.click()}>
        {translate("DCS_RENDERER_UPLOAD_PROMPT")}
      </DcsButtonOutline>
      {!is_builder && (
        <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DROP_FILE_HINT")}
        </p>
      )}
      {read_failed && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_READ_FAILED")}
        </p>
      )}
      {size_exceeded && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_TOO_LARGE")}
        </p>
      )}

      {value && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }} title={value.name}>
            {value.name}
          </span>
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
          {!is_builder && (
            <button
              type="button"
              onClick={handle_remove}
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

      {is_viewer_open && value && (
        <DcsFileViewerModal fileUrl={value.data_url} fileName={value.name} fileType={value.type} onClose={() => setIsViewerOpen(false)} />
      )}

      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
