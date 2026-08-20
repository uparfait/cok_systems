import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_file_kind } from "./fileKind.js";
import DcsAudioPlayer from "./DcsAudioPlayer.jsx";
import DcsVideoPlayer from "./DcsVideoPlayer.jsx";
import DcsFileViewerModal from "./DcsFileViewerModal.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

export default function DcsFilePreview({ fileUrl, fileName, fileType, className }) {
  const { translate } = useDcsLanguage();
  const [is_viewer_open, setIsViewerOpen] = useState(false);
  const kind = get_file_kind(fileType, fileName);

  if (kind === "image") {
    return <img src={fileUrl} alt={fileName} className={className || "max-w-full mx-auto"} />;
  }
  if (kind === "video") {
    return <DcsVideoPlayer src={fileUrl} className={className} />;
  }
  if (kind === "audio") {
    return <DcsAudioPlayer src={fileUrl} className={className} />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm text-center break-all" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
        {fileName}
      </p>
      <DcsButtonOutline onClick={() => setIsViewerOpen(true)}>{translate("DCS_BTN_VIEW")}</DcsButtonOutline>
      {is_viewer_open && (
        <DcsFileViewerModal fileUrl={fileUrl} fileName={fileName} fileType={fileType} onClose={() => setIsViewerOpen(false)} />
      )}
    </div>
  );
}
