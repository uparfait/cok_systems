import React, { useRef, useState } from "react";
import { get_field_text } from "../fieldText.js";
import { read_file_as_data_url } from "../fileHelpers.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFilePreview from "../../components/DcsFilePreview.jsx";

/**
 * Shared rendering for every media capture/upload field (image, video,
 * audio, generic file upload) - a translated trigger button, drag-and-drop,
 * the accepted mime types, a size guard, and a lightweight preview of what
 * was chosen.
 */
export default function BaseMediaField({ field, language, mode, value, onChange, error, accept, capture, previewKind }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);

  const apply_selected_file = async (file) => {
    if (!file || !onChange) return;
    const max_bytes = (field.max_size_mb || 25) * 1024 * 1024;
    if (file.size > max_bytes) return;
    const read_result = await read_file_as_data_url(file);
    onChange(read_result);
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

      {value && (
        <div className="mt-2">
          {previewKind === "image" && <img src={value.data_url} alt={value.name} className="max-w-full max-h-48" />}
          {previewKind === "video" && <video src={value.data_url} controls className="max-w-full max-h-48" />}
          {previewKind === "audio" && <audio src={value.data_url} controls className="w-full" />}
          {previewKind === "file" && <DcsFilePreview fileUrl={value.data_url} fileName={value.name} fileType={value.type} />}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
    </div>
  );
}
