import React, { useRef, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import { IMPORT_ACCEPT, is_import_file, upload_import_file } from "../../services/importService.js";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const TEXT = "#333333";

function format_size(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DcsImportUploadStep({ formGroupId, onUploaded, onBusy }) {
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const input_ref = useRef(null);
  const [file, setFile] = useState(null);
  const [percent, setPercent] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pick = (event) => {
    const chosen = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!chosen) return;
    if (!is_import_file(chosen)) {
      showError(translate("DCS_IMPORT_FILE_TYPE"));
      return;
    }
    setFile(chosen);
    setPercent(null);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    onBusy(true);
    setPercent(0);
    try {
      const response = await upload_import_file(formGroupId, file, setPercent);
      onUploaded(response.data);
    } catch (error) {
      showError(error.message || translate("DCS_IMPORT_ERROR_GENERIC"));
      setPercent(null);
    } finally {
      setUploading(false);
      onBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <p className="text-sm mb-4" style={{ color: TEXT, ...FONT }}>
        {translate("DCS_IMPORT_SUBTITLE")}
      </p>
      <input ref={input_ref} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={pick} />
      <div className="border-2 border-dashed p-5 flex flex-col items-center gap-3" style={{ borderColor: "#E0E0E0" }}>
        <DcsButtonOutline onClick={() => input_ref.current && input_ref.current.click()} disabled={uploading}>
          {translate("DCS_IMPORT_PICK_FILE")}
        </DcsButtonOutline>
        {file ? (
          <p className="text-sm text-center break-all" style={{ color: TEXT, ...FONT }}>
            {file.name} <span style={{ color: MUTED }}>({format_size(file.size)})</span>
          </p>
        ) : (
          <p className="text-xs" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_IMPORT_NO_FILE")}
          </p>
        )}
      </div>

      {percent !== null && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm" style={{ color: "#555555", ...FONT }}>
              {translate("DCS_IMPORT_UPLOADING", { percent })}
            </span>
          </div>
          <Progress.Root className="relative w-full h-3 bg-gray-200 overflow-hidden" value={percent}>
            <Progress.Indicator className="h-full bg-[#056daa] transition-all duration-300 ease-out" style={{ width: `${percent}%` }} />
          </Progress.Root>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <DcsButtonPrimary onClick={upload} disabled={!file || uploading}>
          {uploading ? translate("DCS_WAITING_GENERIC") : translate("DCS_IMPORT_UPLOAD_BTN")}
        </DcsButtonPrimary>
      </div>
    </div>
  );
}
