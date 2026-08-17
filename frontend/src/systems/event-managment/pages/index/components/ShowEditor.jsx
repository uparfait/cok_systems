import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiX, FiUploadCloud, FiDownload, FiEye, FiTrash2, FiLayers,
  FiAlertTriangle,
} from "react-icons/fi";
import SpiralLoader from "../../../components/SpiralLoader";
import MinutesFileViewer, {
  getFileType,
  getFileIcon,
  downloadFile,
  formatBytes,
} from "./MinutesFileViewer";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1GB per file

const b64EncodeUnicode = (str) =>
  btoa(unescape(encodeURIComponent(str)));

function legacyEntry(content) {
  return {
    id: "legacy-minutes",
    name: "Meeting Minutes (document).html",
    type: "text/html",
    size: String(content).length,
    uploadedAt: null,
    dataUrl: `data:text/html;base64,${b64EncodeUnicode(String(content))}`,
  };
}

// Builds the display list from the stored payload: server files plus the
// legacy HTML minutes document (if one exists) shown as a viewable file
function buildEntries(files, legacyContent) {
  const list = Array.isArray(files) ? [...files] : [];
  if (legacyContent) list.unshift(legacyEntry(legacyContent));
  return list;
}

function parseFilesPayload(content) {
  if (!content || !String(content).trim()) return [];
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__cokFiles__) {
      return buildEntries(parsed.files, parsed.legacyContent);
    }
  } catch {
    // not JSON: legacy HTML minutes document
  }
  return [legacyEntry(content)];
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ConfirmRemoveDialog({ file, onConfirm, onCancel, busy }) {
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white w-full max-w-sm p-5 sm:p-6" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 shrink-0" style={{ backgroundColor: "#FDECEA" }}>
            <FiTrash2 className="w-6 h-6" style={{ color: DANGER }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              Remove File
            </h3>
            <p className="text-sm mt-1 break-words" style={{ color: GRAY_DISABLED }}>
              You are about to remove <span className="font-semibold" style={{ color: NEUTRAL_DARK }}>"{file.name}"</span> from these minutes.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onCancel} disabled={busy} className="cok-btn-outlined flex-1 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors disabled:opacity-50"
            style={{ backgroundColor: DANGER, fontFamily: fontHeading, borderRadius: 0, border: 0 }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = "#C0392B"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
          >
            {busy ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShowEditor() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadPct, setUploadPct] = useState(null); // null = not uploading
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [notice, setNotice] = useState("");
  const [viewer, setViewer] = useState(null); // { mode, startIndex }
  const [removeTarget, setRemoveTarget] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 4000);
  }, []);

  useEffect(() => {
    return () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); };
  }, []);

  // Load event + stored files
  useEffect(() => {
    const fetchEventAndMinutes = async () => {
      if (!eventSpecialId) return;
      try {
        setIsLoading(true);
        setIsNotFound(false);
        setError(null);

        const response = await axios.get(`/cok/api/v1/events/${eventSpecialId}/minutes`);

        if (response.data?.success) {
          const { event, minutes } = response.data.data;
          setEventData(event);
          setFiles(parseFilesPayload(minutes?.content));
        } else {
          setIsNotFound(true);
          setError(response.data?.message || "Event not found");
        }
      } catch (err) {
        console.error("Error fetching event and minutes:", err);
        if (err.response?.status === 404) {
          setIsNotFound(true);
          setError("Event not found or no longer available");
        } else {
          setIsNotFound(true);
          setError(err.response?.data?.message || "Failed to load event data. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventAndMinutes();
  }, [eventSpecialId]);

  const addFiles = useCallback(async (fileList) => {
    if (uploadPct != null) return; // an upload is already running
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const tooBig = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length > 0) {
      showNotice(`"${tooBig[0].name}" is too large (max 1GB per file)`);
    }
    const accepted = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
    if (accepted.length === 0) return;

    const formData = new FormData();
    accepted.forEach((f) => formData.append("files", f));

    try {
      setUploadPct(0);
      const response = await axios.post(
        `/cok/api/v1/events/${eventSpecialId}/minutes/files`,
        formData,
        {
          onUploadProgress: (e) => {
            if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
          },
        },
      );
      if (response.data?.success) {
        const { files: serverFiles, legacyContent } = response.data.data;
        setFiles(buildEntries(serverFiles, legacyContent));
        showNotice(response.data.message || "Files uploaded");
      } else {
        showNotice(response.data?.message || "Upload failed");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      showNotice(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setUploadPct(null);
    }
  }, [eventSpecialId, uploadPct, showNotice]);

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return;
    try {
      setIsRemoving(true);
      const response = await axios.delete(
        `/cok/api/v1/events/${eventSpecialId}/minutes/files/${removeTarget.id}`,
      );
      if (response.data?.success) {
        const { files: serverFiles, legacyContent } = response.data.data;
        setFiles(buildEntries(serverFiles, legacyContent));
        showNotice(`Removed "${removeTarget.name}"`);
      } else {
        showNotice(response.data?.message || "Failed to remove file");
      }
    } catch (err) {
      console.error("Remove failed:", err);
      showNotice(err.response?.data?.message || err.message || "Failed to remove file");
    } finally {
      setIsRemoving(false);
      setRemoveTarget(null);
    }
  }, [removeTarget, eventSpecialId, showNotice]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer?.files);
  }, [addFiles]);

  // Error / Not Found
  if (isNotFound || error) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[999999] w-screen h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-white w-full max-w-sm p-5 sm:p-6"
            style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2.5 shrink-0" style={{ backgroundColor: "#FDECEA" }}>
                <FiAlertTriangle className="w-6 h-6" style={{ color: DANGER }} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  Unable to Load Event
                </h3>
                <p className="text-sm mt-1" style={{ color: GRAY_DISABLED }}>
                  {error || "The event you're looking for could not be found or is no longer available."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate(-1)} className="cok-btn-outlined flex-1">
                Go Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="cok-btn-primary flex-1"
                style={{ width: "auto" }}
              >
                Try Again
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999999] w-screen h-screen flex flex-col overflow-hidden"
        style={{ backgroundColor: "#F7F9FB" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div
          className="text-white pl-4 sm:pl-6 pr-0 flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: PRIMARY }}
        >
          <div className="flex items-center gap-3 min-w-0 py-3">
            <h1 className="text-sm sm:text-base font-bold truncate" style={{ fontFamily: fontHeading }}>
              {eventData?.eventName ? `Minutes for ${eventData.eventName}` : "Minutes"}
            </h1>
            {uploadPct != null && (
              <span className="text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.85)" }}>
                Uploading {uploadPct}%
              </span>
            )}
          </div>
          <button
            type="button"
            title="Close"
            onClick={() => navigate(-1)}
            className="self-stretch px-4 cursor-pointer transition-colors flex items-center justify-center"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#E74C3C"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
            {/* Upload zone */}
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              className="hidden"
            />
            <div
              onClick={() => { if (uploadPct == null) inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-8 sm:py-10 px-4 text-center transition-colors"
              style={{
                border: `2px dashed ${dragOver ? PRIMARY : "#9CC7E4"}`,
                backgroundColor: dragOver ? "#E3F2FD" : "#FFFFFF",
              }}
            >
              {uploadPct != null ? (
                <>
                  <div className="w-full max-w-xs h-2" style={{ backgroundColor: "#E3F2FD" }}>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${uploadPct}%`, backgroundColor: PRIMARY }}
                    />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    Uploading {uploadPct}%
                  </p>
                </>
              ) : (
                <>
                  <FiUploadCloud className="w-8 h-8" style={{ color: PRIMARY }} />
                  <p className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    Click to upload or drag files here
                  </p>
                  <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                    Documents, images, and any other files up to 1GB each
                  </p>
                </>
              )}
            </div>

            {/* Notice */}
            {notice && (
              <div
                className="p-3 text-sm"
                style={{ backgroundColor: "#E3F2FD", border: "1px solid #9CC7E4", color: NEUTRAL_DARK, fontFamily: fontHeading }}
              >
                {notice}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                {files.length === 0 ? "No files" : `${files.length} file${files.length > 1 ? "s" : ""}`}
              </p>
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={() => setViewer({ mode: "merged", startIndex: 0 })}
                  className="cok-btn-outlined inline-flex items-center gap-2"
                  style={{ padding: "0.45rem 0.9rem" }}
                >
                  <FiLayers className="w-4 h-4" />
                  View All Merged
                </button>
              )}
            </div>

            {/* Files list */}
            {files.length === 0 ? (
              <div className="bg-white py-14 text-center" style={{ border: `1px solid ${BORDER}` }}>
                <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  No files yet. Upload the minutes documents for this event.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => {
                  const fileType = getFileType(f.name, f.type);
                  return (
                    <div
                      key={f.id || i}
                      className="bg-white flex items-center gap-3 px-3 sm:px-4 py-3 flex-wrap sm:flex-nowrap"
                      style={{ border: `1px solid ${BORDER}` }}
                    >
                      <button
                        type="button"
                        onClick={() => setViewer({ mode: "single", startIndex: i })}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left"
                        title="Click to view"
                      >
                        <div className="p-2 shrink-0" style={{ backgroundColor: "#F7F9FB" }}>
                          {getFileIcon(fileType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold break-words" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                            {f.name}
                          </p>
                          <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                            {[formatBytes(f.size), formatDate(f.uploadedAt)].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <button
                          type="button"
                          title="View"
                          onClick={() => setViewer({ mode: "single", startIndex: i })}
                          className="p-2 cursor-pointer transition-colors hover:bg-[#E3F2FD]"
                          style={{ color: PRIMARY }}
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Download"
                          onClick={() => downloadFile(f)}
                          className="p-2 cursor-pointer transition-colors hover:bg-[#E3F2FD]"
                          style={{ color: PRIMARY }}
                        >
                          <FiDownload className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => setRemoveTarget(f)}
                          className="p-2 cursor-pointer transition-colors hover:bg-[#FDECEA]"
                          style={{ color: DANGER }}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-[999999] w-screen h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-white w-full max-w-sm py-14 flex flex-col items-center justify-center gap-4"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <SpiralLoader />
              <p className="text-sm font-medium pt-2 mt-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                Loading files...
              </p>
            </div>
          </div>
        )}

        {/* File viewer */}
        {viewer && (
          <MinutesFileViewer
            files={files}
            startIndex={viewer.startIndex}
            mode={viewer.mode}
            onClose={() => setViewer(null)}
          />
        )}

        {/* Remove confirmation */}
        <ConfirmRemoveDialog
          file={removeTarget}
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
          busy={isRemoving}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default ShowEditor;
