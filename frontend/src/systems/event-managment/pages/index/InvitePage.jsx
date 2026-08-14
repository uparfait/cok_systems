import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FiUpload, FiX, FiMail, FiCheck, FiAlertCircle, FiCalendar, FiUsers, FiFile, FiTrash2 } from "react-icons/fi";
import SpiralLoader from "../../components/SpiralLoader";
import { useToast } from "@/core/contexts/ToastContext";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = "w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base";

const sectionTitleStyle = { color: PRIMARY, fontFamily: fontHeading };

const pad = (n) => n.toString().padStart(2, "0");

const calculateCountdown = (targetTime) => {
  const totalMs = new Date(targetTime).getTime() - Date.now();
  if (totalMs <= 0) return "00:00:00";
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InvitePage() {
  const { eventId: eventIdFromRoute, id } = useParams();
  const eventId = eventIdFromRoute || id;
  const fileInputRef = useRef(null);
  const { showSuccess, showError } = useToast();

  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [isPastEvent, setIsPastEvent] = useState(false);

  const [manualInput, setManualInput] = useState("");
  const [manualEmails, setManualEmails] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedFileEmails, setParsedFileEmails] = useState([]);
  const [fileError, setFileError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [invitedList, setInvitedList] = useState([]); // saved invited emails from response
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      setEventLoading(true);
      try {
        const endpoints = [
          `${BASE_URL}/events/live?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/upcoming?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/recurring?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/past?search=${eventId}&searchField=eventSpecialId&limit=1`,
        ];

        let foundEvent = null;
        let foundPast = false;
        for (const [idx, endpoint] of endpoints.entries()) {
          const res = await axios.get(endpoint);
          if (res.data?.success && res.data.data?.length > 0) {
            foundEvent = res.data.data[0];
            foundPast = idx === 3; // past events endpoint is index 3
            break;
          }
        }

        if (foundEvent) {
          setEvent(foundEvent);
          setIsPastEvent(foundPast);
        } else {
          setEventError("Event not found");
        }
      } catch (err) {
        setEventError(err.response?.data?.message || "Failed to load event");
      } finally {
        setEventLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  // Remaining time: a live event counts down to its end; an upcoming event
  // counts down to its start. Past events show no countdown.
  const isLiveEvent = !!event?.startedAt && !isPastEvent;
  const countdownTarget = isPastEvent
    ? null
    : isLiveEvent
      ? event?.willEndAt
      : event?.willStartAt;
  const countdownLabel = isLiveEvent ? "Ends in" : "Starts in";

  useEffect(() => {
    if (!countdownTarget) return;

    setCountdown(calculateCountdown(countdownTarget));
    const interval = setInterval(() => {
      setCountdown(calculateCountdown(countdownTarget));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownTarget]);

  const handleManualInputKeyDown = (e) => {
    if (e.key === " " || e.key === "," || e.key === "Enter") {
      e.preventDefault();
      addManualEmail();
    }
  };

  const addManualEmail = () => {
    const value = manualInput.trim().replace(/,+$/, "");
    if (!value) return;
    if (EMAIL_REGEX.test(value)) {
      const lower = value.toLowerCase();
      if (!manualEmails.includes(lower)) {
        setManualEmails((prev) => [...prev, lower]);
      }
    }
    setManualInput("");
  };

  const removeManualEmail = (email) => {
    setManualEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileError(null);
    setParsedFileEmails([]);

    const allowedTypes = [
      "text/plain", "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExts = /\.(csv|txt|xlsx|xls)$/i;

    if (!allowedTypes.includes(file.type) && !allowedExts.test(file.name)) {
      setFileError("Only CSV, TXT, and Excel files are allowed");
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be less than 5MB");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Client-side preview for CSV/TXT only
    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const text = typeof content === "string" ? content : new TextDecoder().decode(content);
        const lines = text.split("\n").length;
        if (lines > 500) {
          setFileError(`File has ${lines} lines. Maximum allowed is 500 lines.`);
          setSelectedFile(null);
          return;
        }
        const parts = text.split(/[\r\n,;\t]+/);
        const emails = [];
        for (const part of parts) {
          const trimmed = part.trim().toLowerCase();
          if (trimmed && EMAIL_REGEX.test(trimmed)) {
            emails.push(trimmed);
          }
        }
        setParsedFileEmails([...new Set(emails)]);
      };
      reader.readAsText(file);
    } else {
      // Excel - can't parse client side, will be parsed server-side
      setParsedFileEmails([]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setParsedFileEmails([]);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (manualEmails.length === 0 && !selectedFile) {
      showError("Please add at least one email or upload a file");
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      if (selectedFile) formData.append("file", selectedFile);
      if (manualEmails.length > 0) formData.append("manualEmails", manualEmails.join(", "));

      const response = await axios.post(
        `${BASE_URL}/events/${eventId}/invite`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (response.data?.success) {
        setSubmitResult(response.data.data);
        // Store invited emails so user can see and remove them
        setInvitedList(response.data.data.invited || []);
        showSuccess(response.data?.message || "Invites sent successfully");
        // Do NOT clear inputs — user can send more or remove unwanted
      } else {
        showError(response.data?.message || "Failed to send invites");
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Remove an invited email from the list after it was saved
  const removeInvitedEmail = async (email) => {
    try {
      // Find the invite record by fetching the list
      const res = await axios.get(`${BASE_URL}/events/${eventId}/invited`, {
        params: { search: email, searchField: "email", limit: 1 }
      });
      if (res.data?.success && res.data.data?.length > 0) {
        const inviteId = res.data.data[0]._id;
        await axios.delete(`/cok/api/v1/events/invited/${inviteId}`);
        // Remove from local list
        setInvitedList((prev) => prev.filter((e) => e !== email));
        if (submitResult) {
          setSubmitResult((prev) => ({
            ...prev,
            invited: prev.invited.filter((e) => e !== email),
            newlyInvited: Math.max(0, prev.newlyInvited - 1),
            validEmails: Math.max(0, prev.validEmails - 1),
          }));
        }
      }
      setDeleteConfirmIdx(null);
    } catch (err) {
      showError(err.response?.data?.message || err.message);
      setDeleteConfirmIdx(null);
    }
  };

  if (eventLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="text-center">
          <div className="mx-auto"><SpiralLoader /></div>
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="text-center w-full max-w-md p-6 sm:p-8" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
          <FiAlertCircle className="w-14 h-14 mx-auto mb-4" style={{ color: DANGER }} />
          <p className="text-lg font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Event Not Found</p>
          <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{eventError || "The event could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const eventStartDate = event.startedAt || event.willStartAt;
  const combinedForPreview = [...new Set([...manualEmails, ...parsedFileEmails])];

  return (
    <div className="w-full min-h-screen py-4 sm:py-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 space-y-4 sm:space-y-5">

        {/* Event header */}
        <div className="px-4 sm:px-6 py-5 text-white" style={{ backgroundColor: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <FiMail className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold leading-tight truncate" style={{ fontFamily: fontHeading, letterSpacing: "-0.5px" }}>
                Invite People
              </h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: fontHeading }}>{event.eventName}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.9)", fontFamily: fontHeading }}>
              <span className="flex items-center gap-1.5">
                <FiCalendar className="w-3.5 h-3.5 shrink-0" />
                {eventStartDate ? new Date(eventStartDate).toLocaleDateString("en-US", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                }) : "TBD"}
              </span>
              <span className="font-semibold uppercase">{event.eventRoom}</span>
            </div>

            {isPastEvent ? (
              <div className="px-4 py-2 text-center self-start sm:self-auto" style={{ backgroundColor: WHITE }}>
                <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Status</div>
                <div className="text-base font-black tracking-wider" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Ended</div>
              </div>
            ) : countdownTarget ? (
              <div className="px-4 py-2 text-center self-start sm:self-auto" style={{ backgroundColor: WHITE }}>
                <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{countdownLabel}</div>
                <div className="text-lg sm:text-xl font-black font-mono tracking-wider" style={{ color: PRIMARY }}>{countdown || "00:00:00"}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Success result with invited emails */}
        {submitResult && (
          <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ backgroundColor: "#E8F5E9" }}>
                <FiCheck className="w-5 h-5" style={{ color: SUCCESS }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Invites Sent Successfully</p>
                <p className="text-xs" style={{ color: SUCCESS, fontFamily: fontHeading }}>{submitResult.newlyInvited} new, {submitResult.alreadyInvited} already invited</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center text-xs mb-4">
              <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <p className="text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{submitResult.totalProvided}</p>
                <p style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Total</p>
              </div>
              <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <p className="text-lg font-bold" style={{ color: SUCCESS, fontFamily: fontHeading }}>{submitResult.validEmails}</p>
                <p style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Valid</p>
              </div>
              <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <p className="text-lg font-bold" style={{ color: DANGER, fontFamily: fontHeading }}>{submitResult.invalidEmails}</p>
                <p style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Invalid</p>
              </div>
            </div>

            {/* Invited emails list with remove */}
            {invitedList.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={sectionTitleStyle}>Invited Emails</p>
                <div className="space-y-1">
                  {invitedList.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <span className="text-xs truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{email}</span>
                      {deleteConfirmIdx === idx ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => removeInvitedEmail(email)}
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 text-white cursor-pointer"
                            style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmIdx(null)}
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 cursor-pointer"
                            style={{ backgroundColor: BORDER, color: NEUTRAL_DARK, fontFamily: fontHeading }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmIdx(idx)}
                          className="p-1 shrink-0 cursor-pointer transition-colors"
                          style={{ color: GRAY_DISABLED }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = DANGER)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = GRAY_DISABLED)}
                          title="Remove this email"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* File upload section - hidden for past events */}
        {!isPastEvent && (<>
        <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={sectionTitleStyle}>
            <FiUpload className="w-4 h-4" />
            Upload File (CSV, TXT, Excel)
          </h2>

          {selectedFile ? (
            <div className="p-3 sm:p-4" style={{ backgroundColor: "#E3F2FD", border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <FiFile className="w-5 h-5 shrink-0" style={{ color: PRIMARY }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{selectedFile.name}</p>
                    <p className="text-xs" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {parsedFileEmails.length > 0 && ` · ${parsedFileEmails.length} emails found`}
                    </p>
                  </div>
                </div>
                <button onClick={removeFile} className="p-1 shrink-0 cursor-pointer" style={{ color: PRIMARY }}>
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              {parsedFileEmails.length > 0 && (
                <div className="mt-3 max-h-20 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {parsedFileEmails.slice(0, 10).map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs" style={{ backgroundColor: WHITE, color: PRIMARY, fontFamily: fontHeading }}>{email}</span>
                    ))}
                    {parsedFileEmails.length > 10 && <span className="text-xs" style={{ color: PRIMARY, fontFamily: fontHeading }}>+{parsedFileEmails.length - 10} more</span>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 sm:p-8 text-center cursor-pointer transition-colors"
              style={{ border: `2px dashed ${BORDER}` }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
            >
              <FiUpload className="w-8 h-8 mx-auto mb-2" style={{ color: GRAY_DISABLED }} />
              <p className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Tap to upload a file</p>
              <p className="text-xs mt-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>CSV, TXT, or Excel files (max 500 lines)</p>
            </div>
          )}
          {fileError && <p className="text-xs mt-2" style={{ color: DANGER, fontFamily: fontHeading }}>{fileError}</p>}
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
        </div>

        {/* Manual email input */}
        <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={sectionTitleStyle}>
            <FiMail className="w-4 h-4" />
            Add Emails Manually
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
              <input
                type="email"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={handleManualInputKeyDown}
                onBlur={addManualEmail}
                placeholder="name@domain.com"
                className={inputClassName}
              />
            </div>
            <button
              type="button"
              onClick={addManualEmail}
              disabled={!manualInput.trim()}
              className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed sm:shrink-0"
              style={{ width: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
            >
              Add
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Type an email then press space, comma, or enter to add it</p>

          {manualEmails.length > 0 && (
            <div className="mt-4">
              <p className="text-xs mb-2" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{manualEmails.length} email(s) added manually</p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {manualEmails.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm" style={{ backgroundColor: "#E3F2FD", border: `1px solid ${BORDER}`, color: PRIMARY, fontFamily: fontHeading }}>
                    <FiMail className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[180px] sm:max-w-none">{email}</span>
                    <button onClick={() => removeManualEmail(email)} className="ml-1 cursor-pointer" style={{ color: GRAY_DISABLED }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = DANGER)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = GRAY_DISABLED)}
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary & Submit — always visible when file or manual emails exist */}
        <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={sectionTitleStyle}>
              <FiUsers className="w-4 h-4" />
              Summary
            </h2>
            <span className="text-lg font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{combinedForPreview.length}</span>
          </div>

          {combinedForPreview.length === 0 && !selectedFile && !submitResult && (
            <div className="flex items-center gap-2 p-3 text-sm" style={{ backgroundColor: "#FFF3E0", border: "1px solid #FFCC80", color: WARNING, fontFamily: fontHeading }}>
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              <span>No emails added yet. Upload a file or type emails manually above.</span>
            </div>
          )}

          {(selectedFile || manualEmails.length > 0) && (
            <div className="text-xs space-y-1 mb-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              <p>From file: <strong style={{ color: NEUTRAL_DARK }}>{parsedFileEmails.length}</strong> emails (server will parse all valid emails)</p>
              <p>Manual: <strong style={{ color: NEUTRAL_DARK }}>{manualEmails.length}</strong> emails</p>
            </div>
          )}

          {/* Submit button — always show when file or manual emails exist, even after previous submit */}
          {(manualEmails.length > 0 || selectedFile) && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  Sending Invites...
                </>
              ) : (
                <>
                  <FiMail className="w-4 h-4" />
                  Send Invites ({combinedForPreview.length || "file"})
                </>
              )}
            </button>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}
