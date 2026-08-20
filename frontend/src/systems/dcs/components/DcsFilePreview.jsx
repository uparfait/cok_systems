import React, { useState } from "react";
import { get_file_kind } from "./fileKind.js";
import DcsAudioPlayer from "./DcsAudioPlayer.jsx";
import DcsVideoPlayer from "./DcsVideoPlayer.jsx";
import DcsFileViewerModal from "./DcsFileViewerModal.jsx";

export default function DcsFilePreview({ fileUrl, fileName, fileType, className, fill }) {
  const [is_viewer_open, setIsViewerOpen] = useState(false);
  const kind = get_file_kind(fileType, fileName);

  if (kind === "image") {
    return <img src={fileUrl} alt={fileName} className={className || "max-w-full mx-auto"} />;
  }
  if (kind === "video") {
    return <DcsVideoPlayer src={fileUrl} className={className} fill={fill} />;
  }
  if (kind === "audio") {
    return <DcsAudioPlayer src={fileUrl} className={className} />;
  }

  return (
    <div className={className || "flex flex-col items-center justify-center gap-3 p-8"}>
      <button
        type="button"
        onClick={() => setIsViewerOpen(true)}
        className="text-sm text-center break-all cursor-pointer hover:underline"
        style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", background: "none", border: "none" }}
      >
        {fileName}
      </button>
      {is_viewer_open && (
        <DcsFileViewerModal fileUrl={fileUrl} fileName={fileName} fileType={fileType} onClose={() => setIsViewerOpen(false)} />
      )}
    </div>
  );
}
