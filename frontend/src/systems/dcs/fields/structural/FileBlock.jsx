import React, { useRef, useState } from "react";
import { read_file_as_data_url } from "../fileHelpers.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFilePreview from "../../components/DcsFilePreview.jsx";

/**
 * A file attached ahead of time to the form (reference material, an
 * instructions document, and so on). Shows an inline preview based on the
 * file's type as soon as one is selected or dropped.
 */
export default function FileBlock({ field, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);

  const apply_selected_file = async (file) => {
    if (!file || !onFieldChange) return;
    const read_result = await read_file_as_data_url(file);
    onFieldChange(Object.assign({}, field, { file_url: read_result.data_url, file_name: read_result.name, file_type: read_result.type }));
  };

  const handle_file_selected = (event) => {
    apply_selected_file(event.target.files && event.target.files[0]);
  };

  const handle_drop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    apply_selected_file(event.dataTransfer.files && event.dataTransfer.files[0]);
  };

  if (is_builder && !field.file_url) {
    return (
      <div
        className="w-full border-2 p-4 text-center"
        style={{
          borderColor: is_drag_over ? "#056daa" : "#E0E0E0",
          borderStyle: "dashed",
          backgroundColor: is_drag_over ? "rgba(5,109,170,0.05)" : "transparent",
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handle_drop}
      >
        <input ref={input_ref} type="file" className="hidden" onChange={handle_file_selected} />
        <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()}>
          {translate("DCS_RENDERER_UPLOAD_PROMPT")}
        </DcsButtonOutline>
        <p className="text-xs mt-2" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DROP_FILE_HINT")}
        </p>
      </div>
    );
  }

  if (!field.file_url) return null;

  return (
    <div className="w-full">
      <DcsFilePreview fileUrl={field.file_url} fileName={field.file_name} fileType={field.file_type} />
      {is_builder && (
        <div className="flex items-center gap-3 mt-2">
          <input ref={input_ref} type="file" className="hidden" onChange={handle_file_selected} />
          <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()}>
            {translate("DCS_BTN_CHANGE")}
          </DcsButtonOutline>
        </div>
      )}
    </div>
  );
}
