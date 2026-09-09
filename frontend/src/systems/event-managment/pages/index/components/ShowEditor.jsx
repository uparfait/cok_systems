import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import mammoth from "mammoth";
import {
  FiX, FiLock, FiUploadCloud, FiTrash2, FiEye, FiDownload,
  FiAlertTriangle, FiMenu, FiFileText, FiRepeat, FiCalendar, FiEdit2,
} from "react-icons/fi";
import SpiralLoader from "../../../components/SpiralLoader";
import Editor from "../../../components/Editor";
import MinutesFileViewer, { downloadFile, formatBytes } from "./MinutesFileViewer";
import { editorStyles } from "../../../components/sub-components/styles";
import {
  pdfBufferToHtml, htmlToPlainText, htmlToPdfBlob, buildDocxBlob,
} from "../../../components/sub-components/fileOperations";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const GRAY_DISABLED = "#9E9E9E";
const WARNING = "#F39C12";
const fontHeading = "'Montserrat', sans-serif";

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1GB per file
const AUTOSAVE_DELAY = 1600;

const EDITABLE_EXTS = ["docx", "doc", "pdf", "txt", "md", "html", "htm", "csv"];
const extOf = (name) => String(name || "").split(".").pop().toLowerCase();
const isEditableAttachment = (f) => EDITABLE_EXTS.includes(extOf(f?.name));
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Minutes are stored as one string: either legacy HTML or a JSON payload
// holding attachments plus the HTML document (mirrors the backend format)
function parsePayload(content) {
  if (!content || !String(content).trim()) return { files: [], legacy: "" };
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__cokFiles__) {
      return {
        files: Array.isArray(parsed.files) ? parsed.files : [],
        legacy: parsed.legacyContent || "",
      };
    }
  } catch {
    // not JSON: legacy HTML minutes document
  }
  return { files: [], legacy: String(content) };
}

function serializePayload(files, legacy) {
  const payload = { __cokFiles__: true, version: 2, files: files || [] };
  if (legacy) payload.legacyContent = legacy;
  return JSON.stringify(payload);
}

const fmtDate = (d) => {
  if (!d) return "Unknown date";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "Unknown date";
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDateTime = (d) => {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
};

function Chip({ children, bg, color }) {
  return (
    <span
      className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: bg, color, fontFamily: fontHeading }}
    >
      {children}
    </span>
  );
}

export default function ShowEditor({ overlayEventId = null, onCloseOverride = null }) {
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const [searchParams] = useSearchParams();
  const readOnly = searchParams.get("readonly") === "1";

  const goBack = () => {
    if (onCloseOverride) onCloseOverride();
    else window.history.back();
  };

  // The editor is also mounted on public routes outside the auth providers,
  // so the logged-in user is read from storage rather than a context hook
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("userData") || "null"); } catch { return null; }
  }, []);
  const userEmail = (storedUser?.email || "").toLowerCase().trim();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [docs, setDocs] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [editorInitial, setEditorInitial] = useState("");
  const [fileEdit, setFileEdit] = useState(null);
  const [fileLoading, setFileLoading] = useState(null);
  const [fileSaving, setFileSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("cok_minutes_sidebar") !== "0");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadPct, setUploadPct] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const docsRef = useRef(docs);
  const selectedIdRef = useRef(selectedId);
  const latestHtmlRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastSavedHtmlRef = useRef(null);
  const saveTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const uploadInputRef = useRef(null);
  const editorRef = useRef(null);

  const saveNowRef = useRef(null);

  // Attachment editing runs as its own document session: saving writes the
  // file back in its original format and never touches the minutes document
  const fileEditRef = useRef(null);
  const fileEditorRef = useRef(null);
  const fileLatestHtmlRef = useRef(null);
  const fileDirtyRef = useRef(false);
  const fileSavingRef = useRef(false);
  const filePendingRef = useRef(false);
  const fileLastSavedRef = useRef(null);
  const fileSaveTimerRef = useRef(null);
  const saveFileNowRef = useRef(null);

  useEffect(() => { docsRef.current = docs; }, [docs]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { fileEditRef.current = fileEdit; }, [fileEdit]);

  // Flush any pending edits when the editor unmounts
  useEffect(() => {
    return () => {
      if (fileDirtyRef.current && saveFileNowRef.current) saveFileNowRef.current();
      if (dirtyRef.current && saveNowRef.current) saveNowRef.current();
    };
  }, []);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (fileSaveTimerRef.current) clearTimeout(fileSaveTimerRef.current);
    };
  }, []);

  const isOrganizerLike = useMemo(() => {
    if (!eventData || !userEmail) return false;
    const org = (eventData.eventOrganizer?.email || "").toLowerCase().trim();
    if (org && org === userEmail) return true;
    return (eventData.coOrganizers || []).some(
      (c) => (c.email || "").toLowerCase().trim() === userEmail
    );
  }, [eventData, userEmail]);

  const canEditDoc = useCallback((doc) => {
    if (readOnly || !doc) return false;
    if (isOrganizerLike) return true;
    const taker = (doc.taker?.email || "").toLowerCase().trim();
    return !!userEmail && !!taker && taker === userEmail;
  }, [readOnly, isOrganizerLike, userEmail]);

  const canOpenDoc = useCallback((doc) => readOnly || canEditDoc(doc), [readOnly, canEditDoc]);

  // Load the event and its whole minutes series (grouped per occurrence date)
  useEffect(() => {
    const load = async () => {
      if (!eventSpecialId) return;
      try {
        setIsLoading(true);
        setLoadError(null);

        const res = await axios.get(`/cok/api/v1/events/${eventSpecialId}/minutes/series`);
        if (!res.data?.success) {
          setLoadError(res.data?.message || "The event could not be loaded");
          return;
        }

        const { event, minutes, isRecurring: recurringFlag } = res.data.data;
        // Occurrence contents can be very large (embedded images and files);
        // keep the raw string per occurrence and parse only what is opened
        const nextDocs = {};
        (minutes || []).forEach((m) => {
          nextDocs[m.eventSpecialId] = {
            id: m.eventSpecialId,
            raw: m.content || "",
            parsed: false,
            files: null,
            legacy: null,
            meetingDate: m.meetingDate,
            lastUpdated: m.lastUpdated,
            taker: m.designatedMinutesTaker || null,
            hasRecord: true,
          };
        });
        if (!nextDocs[eventSpecialId]) {
          nextDocs[eventSpecialId] = {
            id: eventSpecialId,
            raw: "",
            parsed: false,
            files: null,
            legacy: null,
            meetingDate: event?.startedAt || event?.willStartAt || null,
            lastUpdated: null,
            taker: null,
            hasRecord: false,
          };
        }

        // Parse only the occurrence being opened now
        const initial = nextDocs[eventSpecialId];
        const parsed = parsePayload(initial.raw);
        nextDocs[eventSpecialId] = { ...initial, files: parsed.files, legacy: parsed.legacy, parsed: true, raw: "" };
        lastSavedHtmlRef.current = parsed.legacy || "";
        setEditorInitial(parsed.legacy || "");

        // Every ended event id carries an "__<timestamp>" suffix, so "__" alone
        // never means recurring; the real occurrence marker is "parent_<timestamp>"
        const isOccurrenceId = (id) => /^[^_]+_\d+$/.test(String(id).split("__")[0]);
        const recurring = recurringFlag ?? (
          isOccurrenceId(eventSpecialId) ||
          Object.keys(nextDocs).some(isOccurrenceId)
        );

        setEventData(event);
        setIsRecurring(!!recurring);
        setDocs(nextDocs);
        setSelectedId(eventSpecialId);
      } catch (err) {
        console.error("Error loading minutes series:", err);
        setLoadError(err.response?.data?.message || "The event could not be loaded. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventSpecialId]);

  const occurrences = useMemo(() => {
    return Object.values(docs).sort((a, b) => {
      const da = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const db = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      return db - da;
    });
  }, [docs]);

  const selectedDoc = selectedId ? docs[selectedId] : null;

  const saveNow = useCallback(async (htmlOverride = null) => {
    const id = selectedIdRef.current;
    const doc = docsRef.current[id];
    if (!id || !doc) return;
    const html = htmlOverride ?? latestHtmlRef.current ?? doc.legacy ?? "";
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    // Never post identical content again, and never run two saves at once:
    // large documents serialized repeatedly are what freezes the browser
    if (html === lastSavedHtmlRef.current && doc.hasRecord) { dirtyRef.current = false; return; }
    if (savingRef.current) { pendingSaveRef.current = true; return; }

    savingRef.current = true;
    setSaving(true);
    try {
      const res = await axios.post(`/cok/api/v1/events/${id}/minutes`, {
        meetingMinutes: serializePayload(doc.files || [], html),
        documentedBy: storedUser?.fullName ? {
          name: storedUser.fullName,
          role: storedUser.role || "",
          institution: "City of Kigali",
          email: storedUser.email || "",
          phone: "",
        } : undefined,
      });
      if (res.data?.success) {
        dirtyRef.current = false;
        lastSavedHtmlRef.current = html;
        setDocs((prev) => ({
          ...prev,
          [id]: { ...prev[id], legacy: html, hasRecord: true, lastUpdated: new Date().toISOString() },
        }));
      } else {
        showNotice(res.data?.message || "The minutes could not be saved. Please try again.");
      }
    } catch (err) {
      console.error("Save minutes failed:", err);
      showNotice(err.response?.data?.message || "The minutes could not be saved. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveTimerRef.current = setTimeout(() => { saveNowRef.current?.(); }, 300);
      }
    }
  }, [showNotice, storedUser]);

  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  const handleEditorClose = useCallback(() => {
    if (dirtyRef.current) saveNow();
    goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveNow]);

  const onEditorChange = useCallback((html) => {
    latestHtmlRef.current = html;
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveNow(); }, AUTOSAVE_DELAY);
  }, [saveNow]);

  const selectOccurrence = useCallback(async (doc) => {
    if (doc.id === selectedIdRef.current && !fileEditRef.current) return;
    if (!canOpenDoc(doc)) {
      showNotice("You can only open minutes for the occurrences assigned to you.");
      return;
    }
    // Leaving an attachment editing session: flush its pending changes first
    if (fileEditRef.current) {
      if (fileDirtyRef.current && saveFileNowRef.current) await saveFileNowRef.current();
      setFileEdit(null);
      if (doc.id === selectedIdRef.current) return;
    }
    if (dirtyRef.current) await saveNow();

    // Parse the target occurrence lazily, only when it is opened
    const target = docsRef.current[doc.id];
    let parsed;
    if (target?.parsed) {
      parsed = { files: target.files || [], legacy: target.legacy || "" };
    } else {
      parsed = parsePayload(target?.raw);
      setDocs((prev) => ({
        ...prev,
        [doc.id]: { ...prev[doc.id], files: parsed.files, legacy: parsed.legacy, parsed: true, raw: "" },
      }));
    }

    latestHtmlRef.current = null;
    dirtyRef.current = false;
    lastSavedHtmlRef.current = parsed.legacy || "";
    setEditorInitial(parsed.legacy || "");
    setSelectedId(doc.id);
  }, [canOpenDoc, saveNow, showNotice]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      localStorage.setItem("cok_minutes_sidebar", prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const addFiles = useCallback(async (fileList) => {
    const id = selectedIdRef.current;
    const doc = docsRef.current[id];
    if (!id || !doc || uploadPct != null) return;
    if (!canEditDoc(doc)) { showNotice("You are not allowed to upload files on this occurrence."); return; }

    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const tooBig = incoming.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) { showNotice(`"${tooBig.name}" is too large (max 1GB per file)`); }
    const accepted = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
    if (accepted.length === 0) return;

    const formData = new FormData();
    accepted.forEach((f) => formData.append("files", f));

    try {
      setUploadPct(0);
      const res = await axios.post(`/cok/api/v1/events/${id}/minutes/files`, formData, {
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });
      if (res.data?.success) {
        const serverFiles = res.data.data?.files || [];
        setDocs((prev) => ({ ...prev, [id]: { ...prev[id], files: serverFiles, hasRecord: true } }));
        showNotice(res.data.message || "Files uploaded");
        if (dirtyRef.current) saveNow();
      } else {
        showNotice(res.data?.message || "The upload failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      showNotice(err.response?.data?.message || "The upload failed. Please try again.");
    } finally {
      setUploadPct(null);
    }
  }, [uploadPct, canEditDoc, saveNow, showNotice]);

  // Converts an attachment to editable HTML for its own editor session
  const attachmentToHtml = useCallback(async (f) => {
    const src = f.url || f.dataUrl;
    if (!src) throw new Error("The file has no readable source");
    const resp = await fetch(src);
    if (!resp.ok) throw new Error("The file could not be downloaded");

    const ext = extOf(f.name);
    let html = "";
    if (ext === "docx" || ext === "doc") {
      const arrayBuffer = await resp.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value || "";
    } else if (ext === "pdf") {
      const arrayBuffer = await resp.arrayBuffer();
      html = await pdfBufferToHtml(arrayBuffer);
    } else if (ext === "html" || ext === "htm") {
      html = await resp.text();
    } else {
      const text = await resp.text();
      html = text
        .split(/\r?\n/)
        .map((line) => `<p>${escapeHtml(line) || "<br/>"}</p>`)
        .join("");
    }
    return DOMPurify.sanitize(html);
  }, []);

  // Rebuilds the attachment in its original format from the edited HTML
  const htmlToFileBlob = useCallback(async (html, name) => {
    const ext = extOf(name);
    if (ext === "docx" || ext === "doc") return buildDocxBlob(html);
    if (ext === "pdf") return htmlToPdfBlob(html);
    if (ext === "html" || ext === "htm") return new Blob([html], { type: "text/html" });
    const text = htmlToPlainText(html);
    return new Blob([text], { type: ext === "csv" ? "text/csv" : "text/plain" });
  }, []);

  // Saves the edited attachment back to the server as a real file of its own
  // type; the minutes document itself is never modified by this
  const saveFileNow = useCallback(async (htmlOverride = null) => {
    const fe = fileEditRef.current;
    const id = selectedIdRef.current;
    if (!fe || !id) return;
    const html = htmlOverride ?? fileLatestHtmlRef.current ?? fe.html;
    if (fileSaveTimerRef.current) { clearTimeout(fileSaveTimerRef.current); fileSaveTimerRef.current = null; }
    if (html === fileLastSavedRef.current) { fileDirtyRef.current = false; return; }
    if (fileSavingRef.current) { filePendingRef.current = true; return; }

    fileSavingRef.current = true;
    setFileSaving(true);
    try {
      const blob = await htmlToFileBlob(html, fe.file.name);
      const formData = new FormData();
      formData.append("file", blob, fe.file.name);
      const res = await axios.put(`/cok/api/v1/events/${id}/minutes/files/${fe.file.id}`, formData);
      if (res.data?.success) {
        fileDirtyRef.current = false;
        fileLastSavedRef.current = html;
        const serverFiles = res.data.data?.files || [];
        setDocs((prev) => ({ ...prev, [id]: { ...prev[id], files: serverFiles } }));
      } else {
        showNotice(res.data?.message || "The file could not be saved. Please try again.");
      }
    } catch (err) {
      console.error("Save file failed:", err);
      showNotice(err.response?.data?.message || "The file could not be saved. Please try again.");
    } finally {
      fileSavingRef.current = false;
      setFileSaving(false);
      if (filePendingRef.current) {
        filePendingRef.current = false;
        fileSaveTimerRef.current = setTimeout(() => { saveFileNowRef.current?.(); }, 300);
      }
    }
  }, [htmlToFileBlob, showNotice]);

  useEffect(() => { saveFileNowRef.current = saveFileNow; }, [saveFileNow]);

  const onFileEditorChange = useCallback((html) => {
    fileLatestHtmlRef.current = html;
    fileDirtyRef.current = true;
    if (fileSaveTimerRef.current) clearTimeout(fileSaveTimerRef.current);
    // Rebuilding a docx or pdf is heavier than saving minutes HTML,
    // so file autosave runs on a slower debounce
    fileSaveTimerRef.current = setTimeout(() => { saveFileNow(); }, 2500);
  }, [saveFileNow]);

  // Opens an attachment in its own editor session (minutes stay as they are)
  const openFileForEdit = useCallback(async (f) => {
    if (fileLoading) return;
    setFileLoading(f);
    try {
      // Persist any pending minutes edits first, and keep the minutes
      // editor's latest content so it remounts unchanged afterwards
      if (latestHtmlRef.current != null) setEditorInitial(latestHtmlRef.current);
      if (dirtyRef.current) await saveNow();

      const safe = await attachmentToHtml(f);
      fileLatestHtmlRef.current = null;
      fileDirtyRef.current = false;
      filePendingRef.current = false;
      fileLastSavedRef.current = safe;
      setFileEdit({ file: f, html: safe });
    } catch (err) {
      console.error("Attachment open failed:", err);
      showNotice(err?.message || "The file could not be opened in the editor");
    } finally {
      setFileLoading(null);
    }
  }, [fileLoading, saveNow, attachmentToHtml, showNotice]);

  const closeFileEdit = useCallback(() => {
    if (fileDirtyRef.current) saveFileNow();
    setFileEdit(null);
  }, [saveFileNow]);

  const handleRemoveFile = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!removeTarget || !id) return;
    try {
      setIsRemoving(true);
      const res = await axios.delete(`/cok/api/v1/events/${id}/minutes/files/${removeTarget.id}`);
      if (res.data?.success) {
        const serverFiles = res.data.data?.files || [];
        setDocs((prev) => ({ ...prev, [id]: { ...prev[id], files: serverFiles } }));
        showNotice(`Removed "${removeTarget.name}"`);
      } else {
        showNotice(res.data?.message || "The file could not be removed. Please try again.");
      }
    } catch (err) {
      console.error("Remove failed:", err);
      showNotice(err.response?.data?.message || "The file could not be removed. Please try again.");
    } finally {
      setIsRemoving(false);
      setRemoveTarget(null);
    }
  }, [removeTarget, showNotice]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="bg-white flex items-center gap-4 px-8 py-6" style={{ border: `1px solid ${BORDER}` }}>
          <SpiralLoader />
          <span className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading minutes...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[999999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm p-6" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-start gap-3 mb-5">
            <div className="p-2.5 shrink-0" style={{ backgroundColor: "#FDECEA" }}>
              <FiAlertTriangle className="w-6 h-6" style={{ color: DANGER }} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Unable to Load Minutes</h3>
              <p className="text-sm mt-1" style={{ color: GRAY_DISABLED }}>{loadError}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={goBack} className="cok-btn-outlined flex-1 cursor-pointer">Go Back</button>
            <button onClick={() => window.location.reload()} className="cok-btn-primary flex-1 cursor-pointer" style={{ width: "auto" }}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const selectedEditable = canEditDoc(selectedDoc);
  const selectedOpenable = canOpenDoc(selectedDoc);
  const docTitle = eventData?.eventName
    ? `${eventData.eventName}${isRecurring && selectedDoc?.meetingDate ? ` - ${fmtDate(selectedDoc.meetingDate)}` : ""}`
    : "Minutes";
  const eventKindLabel = eventData?.eventMeetingType === "meet" ? "Meeting" : "Event";

  return (
    <div className="fixed inset-0 z-[999999] w-screen h-screen flex overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />

      {/* Sidebar */}
      <aside
        className="h-full flex flex-col shrink-0 bg-white overflow-hidden transition-all duration-200"
        style={{ width: sidebarOpen ? "300px" : "0px", borderRight: sidebarOpen ? `1px solid ${BORDER}` : "none" }}
      >
        <div className="px-4 py-3 text-white shrink-0" style={{ backgroundColor: PRIMARY }}>
          <p className="text-sm font-bold truncate" style={{ fontFamily: fontHeading }} title={eventData?.eventName}>
            {eventData?.eventName || "Minutes"}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Chip bg="rgba(255,255,255,0.2)" color="#FFFFFF">{eventKindLabel}</Chip>
            {isRecurring ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#FFFFFF", color: PRIMARY, fontFamily: fontHeading }}>
                <FiRepeat className="w-3 h-3" />Recurring
              </span>
            ) : (
              <Chip bg="#FFFFFF" color={PRIMARY}>One-time</Chip>
            )}
            {readOnly && <Chip bg="rgba(255,255,255,0.2)" color="#FFFFFF">View only</Chip>}
          </div>
        </div>

        <div className="px-4 pt-3 pb-1 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
            Minutes by date ({occurrences.length})
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {occurrences.map((doc) => {
            const openable = canOpenDoc(doc);
            const editable = canEditDoc(doc);
            const active = doc.id === selectedId;
            const assignedToMe = !!userEmail && (doc.taker?.email || "").toLowerCase().trim() === userEmail;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => selectOccurrence(doc)}
                className={`w-full text-left px-3 py-2.5 mt-1 transition-colors bg-white ${openable ? "cursor-pointer hover:bg-[#F7F9FB]" : "cursor-not-allowed opacity-50"}`}
                style={{ border: `1px solid ${active ? "#B7BCC0" : "#E4E6E8"}` }}
                title={openable ? fmtDateTime(doc.meetingDate) : "You are not assigned to these minutes"}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    <FiCalendar className="w-3.5 h-3.5 shrink-0" style={{ color: active ? PRIMARY : GRAY_DISABLED }} />
                    {fmtDate(doc.meetingDate)}
                  </span>
                  {!openable && <FiLock className="w-3.5 h-3.5 shrink-0" style={{ color: GRAY_DISABLED }} />}
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: GRAY_DISABLED }}>
                  {doc.taker?.name ? `Taker: ${doc.taker.name}` : "No minutes taker assigned"}
                </p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {assignedToMe && <Chip bg="rgba(243,156,18,0.15)" color={WARNING}>Assigned to you</Chip>}
                  {!doc.hasRecord && <Chip bg="rgba(51,51,51,0.08)" color="#555555">No minutes yet</Chip>}
                  {doc.hasRecord && !editable && !readOnly && <Chip bg="rgba(51,51,51,0.08)" color="#555555">Locked</Chip>}
                  {(doc.files?.length || 0) > 0 && <Chip bg="rgba(51,51,51,0.08)" color="#555555">{doc.files.length} file{doc.files.length > 1 ? "s" : ""}</Chip>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Attachments for the selected occurrence (drop files here to upload) */}
        <div
          className="shrink-0 border-t px-3 py-3 max-h-[40%] overflow-y-auto"
          style={{ borderColor: BORDER, backgroundColor: dragOver ? "rgba(5,109,170,0.05)" : "transparent" }}
          onDragOver={(e) => { if (selectedEditable) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (selectedEditable) addFiles(e.dataTransfer?.files); }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              Attachments ({selectedDoc?.files?.length || 0})
            </p>
            {selectedEditable && (
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadPct != null}
                className="cok-btn-outlined cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                style={{ padding: "0.25rem 0.6rem", fontSize: "10px" }}
              >
                <FiUploadCloud className="w-3 h-3" />Upload
              </button>
            )}
          </div>

          {uploadPct != null && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                <span>Uploading...</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="w-full h-1.5" style={{ backgroundColor: BORDER }}>
                <div className="h-full transition-all duration-200" style={{ width: `${uploadPct}%`, backgroundColor: PRIMARY }} />
              </div>
            </div>
          )}

          {(selectedDoc?.files || []).length === 0 && uploadPct == null ? (
            <p className="text-xs py-2 text-center" style={{ color: GRAY_DISABLED }}>
              {selectedEditable ? "No attachments yet. Drop files here or use Upload (PDF, Word, images and more)." : "No attachments on this date."}
            </p>
          ) : (
            (selectedDoc?.files || []).map((f, i) => (
              <div key={f.id || i} className="flex items-center gap-2 px-2 py-1.5 mt-1 transition-colors bg-white hover:bg-[#F7F9FB]" style={{ border: "1px solid #E4E6E8" }}>
                <FiFileText className="w-3.5 h-3.5 shrink-0" style={{ color: "#555555" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: NEUTRAL_DARK }} title={f.name}>{f.name}</p>
                  <p className="text-[10px]" style={{ color: GRAY_DISABLED }}>
                    {formatBytes(f.size)}
                    {f.uploadedAt ? ` | Uploaded ${fmtDateTime(f.uploadedAt)}` : ""}
                    {f.updatedAt ? ` | Edited ${fmtDateTime(f.updatedAt)}` : ""}
                  </p>
                </div>
                <button type="button" title="Open" onClick={() => setViewer({ files: selectedDoc.files, startIndex: i })} className="p-1 cursor-pointer hover:bg-white" style={{ color: PRIMARY }}>
                  <FiEye className="w-3.5 h-3.5" />
                </button>
                {selectedEditable && isEditableAttachment(f) && (
                  <button
                    type="button"
                    title="Edit this file in the editor"
                    onClick={() => openFileForEdit(f)}
                    disabled={!!fileLoading}
                    className="p-1 cursor-pointer hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: "#555555" }}
                  >
                    {fileLoading?.id === f.id ? <SpiralLoader padded={false} size={14} /> : <FiEdit2 className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button type="button" title="Download" onClick={() => downloadFile(f)} className="p-1 cursor-pointer hover:bg-white" style={{ color: "#555555" }}>
                  <FiDownload className="w-3.5 h-3.5" />
                </button>
                {selectedEditable && (
                  <button type="button" title="Remove" onClick={() => setRemoveTarget(f)} className="p-1 cursor-pointer hover:bg-white" style={{ color: DANGER }}>
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {isRecurring && (
          <div className="shrink-0 px-4 py-2 border-t" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
            <p className="text-[10px]" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              Recurring {eventKindLabel.toLowerCase()}: minutes are grouped by the date each occurrence happened.
            </p>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {fileEdit ? (
          <Editor
            key={`file-${fileEdit.file.id}`}
            initialContent={fileEdit.html}
            title={fileEdit.file.name}
            isSaving={fileSaving}
            handleClose={closeFileEdit}
            handleSave={(html) => saveFileNow(html)}
            onChange={onFileEditorChange}
            onToggleSidebar={toggleSidebar}
            externalEditorRef={fileEditorRef}
          />
        ) : selectedEditable ? (
          <Editor
            key={selectedId}
            initialContent={editorInitial}
            title={docTitle}
            isSaving={saving}
            handleClose={handleEditorClose}
            handleSave={(html) => saveNow(html)}
            onChange={onEditorChange}
            onToggleSidebar={toggleSidebar}
            externalEditorRef={editorRef}
          />
        ) : selectedOpenable ? (
          <>
            <div className="text-white pl-3 pr-0 text-[13px] flex items-center justify-between shrink-0" style={{ backgroundColor: PRIMARY }}>
              <div className="flex items-center gap-2 min-w-0 py-1.5">
                <button type="button" title="Toggle sidebar" onClick={toggleSidebar} className="p-1 cursor-pointer" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <FiMenu className="w-4 h-4" />
                </button>
                <span className="font-semibold truncate" style={{ fontFamily: fontHeading }}>{docTitle} (View only)</span>
              </div>
              <button type="button" title="Close" onClick={goBack} className="self-stretch px-3 cursor-pointer flex items-center justify-center" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DANGER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto py-4 sm:py-8 px-2 sm:px-4 flex justify-center" style={{ backgroundColor: "#F3F5F7" }}>
              <div className="bg-white w-[8.5in] max-w-[calc(100vw-16px)] h-max overflow-hidden" style={{ minHeight: "11in" }}>
                <div className="px-6 py-10 sm:px-14 sm:py-16">
                  {selectedDoc?.legacy ? (
                    <div className="tiptap-msword" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedDoc.legacy) }} />
                  ) : (
                    <p className="text-sm text-center" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No minutes recorded for this date yet.</p>
                  )}
                </div>
              </div>
            </div>
            <style>{editorStyles}</style>
          </>
        ) : (
          <>
            <div className="text-white pl-3 pr-0 text-[13px] flex items-center justify-between shrink-0" style={{ backgroundColor: PRIMARY }}>
              <div className="flex items-center gap-2 min-w-0 py-1.5">
                <button type="button" title="Toggle sidebar" onClick={toggleSidebar} className="p-1 cursor-pointer" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <FiMenu className="w-4 h-4" />
                </button>
                <span className="font-semibold truncate" style={{ fontFamily: fontHeading }}>{docTitle}</span>
              </div>
              <button type="button" title="Close" onClick={goBack} className="self-stretch px-3 cursor-pointer flex items-center justify-center" onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DANGER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-white max-w-sm w-full p-6 text-center" style={{ border: `1px solid ${BORDER}` }}>
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(243,156,18,0.12)" }}>
                  <FiLock className="w-7 h-7" style={{ color: WARNING }} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Minutes Locked</h3>
                <p className="text-sm" style={{ color: GRAY_DISABLED }}>
                  Only the organizer, co-organizers, or the designated minutes taker for this date can open these minutes.
                  {isRecurring ? " Pick an occurrence assigned to you from the sidebar." : ""}
                </p>
                <button onClick={goBack} className="cok-btn-outlined mt-5 cursor-pointer" style={{ padding: "0.5rem 1.4rem" }}>Go Back</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lightweight notice (this editor also mounts outside the toast provider) */}
      {notice && (
        <div className="fixed bottom-4 left-4 z-[1000001] px-3 py-2 text-xs text-white" style={{ backgroundColor: NEUTRAL_DARK, fontFamily: fontHeading }}>
          {notice}
        </div>
      )}

      {viewer && (
        <MinutesFileViewer
          files={viewer.files}
          startIndex={viewer.startIndex}
          mode="single"
          onClose={() => setViewer(null)}
        />
      )}

      {fileLoading && (
        <div className="fixed inset-0 z-[1000000] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white flex items-center gap-3 px-6 py-4">
            <SpiralLoader padded={false} size={20} />
            <span className="text-sm break-words" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              Opening "{fileLoading.name}" for editing...
            </span>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[1000000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold text-base mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Remove File</h3>
            <p className="text-sm mb-5 break-words" style={{ color: GRAY_DISABLED }}>
              Remove <span className="font-semibold" style={{ color: NEUTRAL_DARK }}>"{removeTarget.name}"</span> from these minutes? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRemoveTarget(null)} disabled={isRemoving} className="cok-btn-outlined flex-1 cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleRemoveFile} disabled={isRemoving} className="cok-btn-outlined-danger flex-1 cursor-pointer disabled:opacity-60">
                {isRemoving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
