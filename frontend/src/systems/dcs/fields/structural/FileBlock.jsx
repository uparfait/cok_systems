import React, { useRef, useState } from "react";
import { upload_design_file_with_progress, delete_design_file } from "../../services/designUploadService.js";
import { useDesignUpload } from "../../builder/DesignUploadContext.jsx";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsFilePreview from "../../components/DcsFilePreview.jsx";

export default function FileBlock({ field, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const { register_progress, clear_progress } = useDesignUpload();
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);
  const [is_deleting_old, setIsDeletingOld] = useState(false);
  const [is_uploading, setIsUploading] = useState(false);
  const [upload_percent, setUploadPercent] = useState(0);
  const [upload_failed, setUploadFailed] = useState(false);
  const [is_link_mode, setIsLinkMode] = useState(false);
  const [link_value, setLinkValue] = useState("");
  const fills_container = !!field.section_layout;
  const is_busy = is_deleting_old || is_uploading;

  // Whatever the field currently points at is about to be replaced -
  // deleted first, so a form edited over and over never leaves a trail of
  // orphaned uploads on disk, before the new file/link is even attempted.
  const delete_previous_file = async () => {
    if (!field.file_url) return;
    setIsDeletingOld(true);
    try {
      await delete_design_file(field.file_url);
    } finally {
      setIsDeletingOld(false);
    }
  };

  const apply_selected_file = async (file) => {
    if (!file || !onFieldChange) return;
    setUploadFailed(false);
    await delete_previous_file();
    setIsUploading(true);
    setUploadPercent(0);
    register_progress(field.id, 0);
    try {
      const uploaded = await upload_design_file_with_progress(file, {
        onProgress: (percent) => {
          setUploadPercent(percent);
          register_progress(field.id, percent);
        },
      });
      onFieldChange(Object.assign({}, field, { file_url: uploaded.url, file_name: uploaded.name, file_type: uploaded.type }));
    } catch (error) {
      setUploadFailed(true);
    } finally {
      setIsUploading(false);
      clear_progress(field.id);
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

  const apply_link = async () => {
    if (!link_value.trim() || !onFieldChange) return;
    const next_url = link_value.trim();
    await delete_previous_file();
    onFieldChange(Object.assign({}, field, { file_url: next_url, file_name: next_url, file_type: "" }));
    setLinkValue("");
    setIsLinkMode(false);
  };

  const action_label = is_deleting_old
    ? translate("DCS_DESIGN_WAITING_FILE_DELETION")
    : is_uploading
      ? translate("DCS_UPLOADING_PERCENT", { percent: upload_percent })
      : null;

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
        {is_link_mode ? (
          <div className="flex flex-col items-center gap-2">
            <input
              className="cok-auth-input w-full py-2"
              placeholder="https://..."
              value={link_value}
              onChange={(event) => setLinkValue(event.target.value)}
            />
            <div className="flex gap-2">
              <DcsButtonOutline disabled={is_busy} onClick={apply_link}>
                {action_label || translate("DCS_BTN_USE_LINK")}
              </DcsButtonOutline>
              <DcsButtonOutline disabled={is_busy} onClick={() => setIsLinkMode(false)}>{translate("DCS_BTN_CANCEL")}</DcsButtonOutline>
            </div>
          </div>
        ) : (
          <>
            <input ref={input_ref} type="file" className="hidden" onChange={handle_file_selected} />
            <DcsButtonOutline disabled={is_busy} onClick={() => input_ref.current && input_ref.current.click()}>
              {action_label || translate("DCS_RENDERER_UPLOAD_PROMPT")}
            </DcsButtonOutline>
            <p className="text-xs mt-2" style={{ color: "#9E9E9E" }}>
              {translate("DCS_DROP_FILE_HINT")}
            </p>
            <button type="button" className="text-xs mt-1 underline cursor-pointer" style={{ color: "#056daa" }} onClick={() => setIsLinkMode(true)}>
              {translate("DCS_BTN_USE_LINK_INSTEAD")}
            </button>
            {upload_failed && (
              <p className="text-xs mt-2" style={{ color: "#E74C3C" }}>
                {translate("DCS_FILE_UPLOAD_FAILED")}
              </p>
            )}
          </>
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
          <DcsButtonOutline disabled={is_busy} onClick={() => input_ref.current && input_ref.current.click()}>
            {action_label || translate("DCS_BTN_CHANGE")}
          </DcsButtonOutline>
          {upload_failed && (
            <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
              {translate("DCS_FILE_UPLOAD_FAILED")}
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
          <DcsButtonOutline disabled={is_busy} onClick={() => input_ref.current && input_ref.current.click()}>
            {action_label || translate("DCS_BTN_CHANGE")}
          </DcsButtonOutline>
        </div>
      )}
      {upload_failed && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FILE_UPLOAD_FAILED")}
        </p>
      )}
    </div>
  );
}
