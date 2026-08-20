import React, { useRef, useState } from "react";
import { read_file_as_data_url } from "../fileHelpers.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFilePreview from "../../components/DcsFilePreview.jsx";

export default function FileBlock({ field, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);
  const [is_reading, setIsReading] = useState(false);
  const [read_failed, setReadFailed] = useState(false);
  const fills_container = !!field.section_layout;

  const apply_selected_file = async (file) => {
    if (!file || !onFieldChange) return;
    setIsReading(true);
    setReadFailed(false);
    try {
      const read_result = await read_file_as_data_url(file);
      onFieldChange(Object.assign({}, field, { file_url: read_result.data_url, file_name: read_result.name, file_type: read_result.type }));
    } catch (error) {
      setReadFailed(true);
    } finally {
      setIsReading(false);
    }
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
        className={fills_container ? "w-full h-full border-2 p-2 text-center overflow-hidden" : "w-full border-2 p-4 text-center"}
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
        <DcsButtonOutline disabled={is_reading} onClick={() => input_ref.current && input_ref.current.click()}>
          {translate("DCS_RENDERER_UPLOAD_PROMPT")}
        </DcsButtonOutline>
        <p className="text-xs mt-2" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DROP_FILE_HINT")}
        </p>
        {read_failed && (
          <p className="text-xs mt-2" style={{ color: "#E74C3C" }}>
            {translate("DCS_FILE_READ_FAILED")}
          </p>
        )}
      </div>
    );
  }

  if (!field.file_url) return null;

  if (fills_container) {
    if (!is_builder) {
      return (
        <div className="w-full h-full relative overflow-hidden">
          <DcsFilePreview
            fileUrl={field.file_url}
            fileName={field.file_name}
            fileType={field.file_type}
            className="w-full h-full flex flex-col items-center justify-center gap-2 p-2"
            fill
          />
        </div>
      );
    }
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          <DcsFilePreview
            fileUrl={field.file_url}
            fileName={field.file_name}
            fileType={field.file_type}
            className="w-full h-full flex flex-col items-center justify-center gap-2 p-2"
            fill
          />
        </div>
        <div className="flex-shrink-0 mt-1">
          <input ref={input_ref} type="file" className="hidden" onChange={handle_file_selected} />
          <DcsButtonOutline disabled={is_reading} onClick={() => input_ref.current && input_ref.current.click()}>
            {translate("DCS_BTN_CHANGE")}
          </DcsButtonOutline>
          {read_failed && (
            <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
              {translate("DCS_FILE_READ_FAILED")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <DcsFilePreview fileUrl={field.file_url} fileName={field.file_name} fileType={field.file_type} />
      {is_builder && (
        <div className="flex items-center gap-3 mt-2">
          <input ref={input_ref} type="file" className="hidden" onChange={handle_file_selected} />
          <DcsButtonOutline disabled={is_reading} onClick={() => input_ref.current && input_ref.current.click()}>
            {translate("DCS_BTN_CHANGE")}
          </DcsButtonOutline>
        </div>
      )}
      {read_failed && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_READ_FAILED")}
        </p>
      )}
    </div>
  );
}
