import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { FiUpload, FiX, FiMail, FiCheck, FiAlertCircle, FiCalendar, FiUsers, FiArrowLeft, FiDownload, FiTrash2 } from "react-icons/fi";
import SpiralLoader from "../../components/SpiralLoader";

const BASE_URL = "/cok/api/v1";

const calculateCountdown = (targetTime) => {
  const totalMs = new Date(targetTime).getTime() - new Date().getTime();
  if (totalMs <= 0) return "00:00:00";
  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)));
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InvitePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
  const [error, setError] = useState(null);
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

  useEffect(() => {
    if (!event) return;
    const targetTime = event.startedAt || event.willStartAt || event.willEndAt;
    if (!targetTime) return;

    setCountdown(calculateCountdown(targetTime));
    const interval = setInterval(() => {
      setCountdown(calculateCountdown(targetTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [event]);

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
      setError("Please add at least one email or upload a file");
      return;
    }

    setSubmitting(true);
    setError(null);
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
        // Do NOT clear inputs — user can send more or remove unwanted
      } else {
        setError(response.data?.message || "Failed to send invites");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send invites");
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
      console.error("Failed to remove invited email:", err);
      setDeleteConfirmIdx(null);
    }
  };

  if (eventLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto"><SpiralLoader /></div>
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center max-w-md p-8">
          <FiAlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-zinc-800 mb-2">Event Not Found</p>
          <p className="text-sm text-zinc-500 mb-6">{eventError || "The event could not be loaded."}</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const eventTargetTime = event.startedAt || event.willStartAt || event.willEndAt;
  const eventStartDate = event.startedAt || event.willStartAt;
  const combinedForPreview = [...new Set([...manualEmails, ...parsedFileEmails])];

  return (
    <div className="w-full min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Event header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-zinc-900 truncate">{event.eventName}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500">
                <span className="flex items-center gap-1">
                  <FiCalendar className="w-3.5 h-3.5" />
                  {eventStartDate ? new Date(eventStartDate).toLocaleDateString("en-US", {
                    weekday: "short", year: "numeric", month: "short", day: "numeric",
                  }) : "TBD"}
                </span>
                <span className="font-mono text-blue-600 font-semibold">{event.eventRoom}</span>
              </div>
            </div>
            {eventTargetTime && (
              <div className="bg-blue-600 text-white px-4 py-2 text-center shrink-0">
                <div className="text-[10px] uppercase font-bold tracking-widest">Remaining</div>
                <div className="text-xl font-black font-mono tracking-wider">{countdown || "00:00:00"}</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 flex items-center gap-3">
            <FiAlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success result with invited emails */}
        {submitResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 border border-green-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Invites Sent Successfully</p>
                <p className="text-xs text-green-600">{submitResult.newlyInvited} new, {submitResult.alreadyInvited} already invited</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs mb-4">
              <div className="bg-white p-2 border border-green-100">
                <p className="text-lg font-bold text-green-700">{submitResult.totalProvided}</p>
                <p className="text-green-600">Total</p>
              </div>
              <div className="bg-white p-2 border border-green-100">
                <p className="text-lg font-bold text-green-700">{submitResult.validEmails}</p>
                <p className="text-green-600">Valid</p>
              </div>
              <div className="bg-white p-2 border border-green-100">
                <p className="text-lg font-bold text-red-500">{submitResult.invalidEmails}</p>
                <p className="text-red-500">Invalid</p>
              </div>
            </div>

            {/* Invited emails list with remove */}
            {invitedList.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-green-700 mb-2">Invited Emails:</p>
                <div className="space-y-1">
                  {invitedList.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 border border-green-100">
                      <span className="text-xs text-green-800 truncate">{email}</span>
                      {deleteConfirmIdx === idx ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeInvitedEmail(email)}
                            className="text-[10px] px-2 py-1 bg-red-500 text-white hover:bg-red-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmIdx(null)}
                            className="text-[10px] px-2 py-1 bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmIdx(idx)}
                          className="text-red-400 hover:text-red-600 p-1"
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
          </motion.div>
        )}

        {/* File upload section - hidden for past events */}
        {!isPastEvent && (<>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FiUpload className="w-4 h-4" />
            Upload File (CSV, TXT, Excel)
          </h2>

          {selectedFile ? (
            <div className="bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FiDownload className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-800 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-blue-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {parsedFileEmails.length > 0 && ` · ${parsedFileEmails.length} emails found`}
                    </p>
                  </div>
                </div>
                <button onClick={removeFile} className="p-1 hover:bg-blue-100 text-blue-600 transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              {parsedFileEmails.length > 0 && (
                <div className="mt-3 max-h-20 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {parsedFileEmails.slice(0, 10).map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs">{email}</span>
                    ))}
                    {parsedFileEmails.length > 10 && <span className="text-xs text-blue-500">+{parsedFileEmails.length - 10} more</span>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-zinc-300 hover:border-blue-400 p-8 text-center cursor-pointer transition-colors">
              <FiUpload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-600 font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-zinc-400 mt-1">CSV, TXT, or Excel files (max 500 lines)</p>
            </div>
          )}
          {fileError && <p className="text-xs text-red-500 mt-2">{fileError}</p>}
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
        </motion.div>

        {/* Manual email input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FiMail className="w-4 h-4" />
            Add Emails Manually
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleManualInputKeyDown}
              onBlur={addManualEmail}
              placeholder="Type email and press space, comma, or enter..."
              className="flex-1 px-3 py-2 border border-zinc-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button type="button" onClick={addManualEmail} disabled={!manualInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Type an email then press space, comma, or enter to add it as a chip</p>

          {manualEmails.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-zinc-500 mb-2">{manualEmails.length} email(s) added manually</p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {manualEmails.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                    <FiMail className="w-3 h-3" />
                    {email}
                    <button onClick={() => removeManualEmail(email)} className="ml-1 text-blue-400 hover:text-red-500 transition-colors">
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Summary & Submit — always visible when file or manual emails exist */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <FiUsers className="w-4 h-4" />
              Summary
            </h2>
            <span className="text-lg font-bold text-blue-600">{combinedForPreview.length}</span>
          </div>

          {combinedForPreview.length === 0 && !selectedFile && !submitResult && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              <span>No emails added yet. Upload a file or type emails manually above.</span>
            </div>
          )}

          {(selectedFile || manualEmails.length > 0) && (
            <div className="text-xs text-zinc-500 space-y-1 mb-4">
              <p>From file: <strong>{parsedFileEmails.length}</strong> emails (server will parse all valid emails)</p>
              <p>Manual: <strong>{manualEmails.length}</strong> emails</p>
            </div>
          )}

          {/* Submit button — always show when file or manual emails exist, even after previous submit */}
          {(manualEmails.length > 0 || selectedFile) && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        </motion.div>
        </>)}
      </div>
    </div>
  );
}
