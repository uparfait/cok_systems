import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFileViewerModal from "./DcsFileViewerModal.jsx";

/**
 * One collected-data table cell for a media answer (image/video/audio/
 * file_upload/signature). The stored answer is an object
 * ({name,type,size,url}, uploaded to disk storage) - value.data_url is only
 * ever read as a fallback for a submission collected before that migration,
 * still sitting in the database with its file embedded as base64; a bare
 * string is the same fallback for an old signature answer. Either way it is
 * never something a table cell should try to stringify directly, so this
 * renders a "click to view" trigger that opens the same popup viewer used
 * elsewhere instead.
 */
export default function DcsDataTableFileCell({ value, fieldType }) {
  const { translate } = useDcsLanguage();
  const [is_open, setIsOpen] = useState(false);

  const is_object_answer = value && typeof value === "object";
  const file_url = is_object_answer ? value.url || value.data_url : value;
  if (!file_url) return null;

  const file_name = (is_object_answer && value.name) || `${fieldType}.png`;
  const file_type = (is_object_answer && value.type) || "image/png";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer text-sm hover:underline"
        style={{ background: "none", border: "none", padding: 0, color: "#056daa" }}
      >
        {translate("DCS_TABLE_VIEW_FILE")}
      </button>
      {is_open && <DcsFileViewerModal fileUrl={file_url} fileName={file_name} fileType={file_type} onClose={() => setIsOpen(false)} />}
    </>
  );
}
