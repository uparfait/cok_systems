import React, { useRef, useState } from "react";
import { read_file_as_data_url } from "../fileHelpers.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";

/**
 * A static image (a logo, a letterhead, decorative artwork) authored once
 * into the form itself rather than collected from a respondent. Resized by
 * width; horizontal position and box width come from the renderer's own
 * design wrapper (dragged position, full-device-width toggle).
 */
export default function ImageBlock({ field, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const input_ref = useRef(null);
  const [is_drag_over, setIsDragOver] = useState(false);

  const apply_selected_file = async (file) => {
    if (!file || !onFieldChange) return;
    const read_result = await read_file_as_data_url(file);
    onFieldChange(Object.assign({}, field, { image_url: read_result.data_url }));
  };

  const handle_file_selected = (event) => {
    apply_selected_file(event.target.files && event.target.files[0]);
  };

  const handle_drop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (!is_builder) return;
    apply_selected_file(event.dataTransfer.files && event.dataTransfer.files[0]);
  };

  if (!field.image_url) {
    if (!is_builder) return null;
    return (
      <div
        className={field.section_layout ? "w-full h-full border-2 p-2 text-center overflow-hidden" : "w-full border-2 p-4 text-center"}
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
        <input ref={input_ref} type="file" accept="image/*" className="hidden" onChange={handle_file_selected} />
        <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()}>
          {translate("DCS_BTN_UPLOAD_IMAGE")}
        </DcsButtonOutline>
        <p className="text-xs mt-2" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DROP_FILE_HINT")}
        </p>
      </div>
    );
  }

  // Placed inside a Section: the section's own layout box is what
  // determines this image's size, so it fills that box exactly instead of
  // rendering at its own width_px and leaving empty space around it.
  if (field.section_layout) {
    return (
      <div className="w-full h-full relative">
        <img src={field.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        {is_builder && (
          <div className="absolute bottom-1 left-1">
            <input ref={input_ref} type="file" accept="image/*" className="hidden" onChange={handle_file_selected} />
            <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()}>
              {translate("DCS_BTN_CHANGE")}
            </DcsButtonOutline>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex" style={{ justifyContent: "flex-start" }}>
      <div>
        <img src={field.image_url} alt="" style={{ width: field.width_px || 200, maxWidth: "100%", display: "block" }} />
        {is_builder && (
          <div className="mt-2">
            <input ref={input_ref} type="file" accept="image/*" className="hidden" onChange={handle_file_selected} />
            <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()}>
              {translate("DCS_BTN_CHANGE")}
            </DcsButtonOutline>
          </div>
        )}
      </div>
    </div>
  );
}
