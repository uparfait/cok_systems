import { AnimatePresence, motion } from "framer-motion";
import Editor from "../../../components/Editor";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useOutletContext,
  useParams,
  useNavigate,
} from "react-router-dom";
import axios from "axios";
import SpiralLoader from "../../../components/SpiralLoader";

// Unsaved Changes Confirmation Dialog
function UnsavedChangesDialog({ isOpen, onConfirm, onCancel, isSaving }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="relative bg-white w-[420px] p-8 shadow-2xl flex flex-col items-center gap-6"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Warning Icon */}
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-900 mb-2">
                Unsaved Changes
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {isSaving
                  ? "Your changes are currently being saved. If you close now, recent edits may be lost."
                  : "You have unsaved changes that haven't been saved yet. Are you sure you want to close?"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-700 font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                Continue Editing
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors"
              >
                {isSaving ? "Close Anyway" : "Discard & Close"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShowEditor() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();
  const context = useOutletContext();
  const contextActiveEvent = context?.activeEvent;

  // Component state management
  const [initialContent, setInitialContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // Data fetching states
  const [eventData, setEventData] = useState(null);
  const [minutesData, setMinutesData] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef(null);
  const lastSavedContentRef = useRef("");

  // Fetch event data and minutes on mount
  useEffect(() => {
    const fetchEventAndMinutes = async () => {
      if (!eventSpecialId) return;

      try {
        setIsLoading(true);
        setIsNotFound(false);
        setError(null);

        // Fetch minutes (this also returns event data)
        const response = await axios.get(
          `/cok/api/v1/events/${eventSpecialId}/minutes`
        );

        if (response.data?.success) {
          const { event, minutes } = response.data.data;
          
          setEventData(event);
          setMinutesData(minutes);
          
          // Set initial content from existing minutes or empty string
          const content = minutes?.content || "";
          setInitialContent(content);
          lastSavedContentRef.current = content;
          
          setShowEditor(true);
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
          setError("Failed to load event data. Please try again.");
          setIsNotFound(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventAndMinutes();
  }, [eventSpecialId]);

  // Handle content changes with auto-save
  const onChange = useCallback((data) => {
    setInitialContent(data);
    
    // Check if content has changed from last saved state
    if (data !== lastSavedContentRef.current) {
      setHasUnsavedChanges(true);
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer (2 seconds after last edit)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(data);
    }, 2000);
  }, []);

  // Save minutes to API using eventSpecialId
  const handleSave = async (content) => {
    if (!eventSpecialId || !content) return;

    try {
      setIsSaving(true);

      const response = await axios.post(
        `/cok/api/v1/events/${eventSpecialId}/minutes`,
        {
          meetingMinutes: content,
        }
      );

      if (response.data?.success) {
        lastSavedContentRef.current = content;
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Error saving minutes:", err);
      // Could show error toast here
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(async () => {
    // If currently saving or has unsaved changes, show confirmation dialog
    if (isSaving || (hasUnsavedChanges && initialContent !== lastSavedContentRef.current)) {
      setShowCloseDialog(true);
      return;
    }

    // No unsaved changes, close immediately
    navigate(-1);
  }, [isSaving, hasUnsavedChanges, initialContent, navigate]);

  // Confirm close (discard changes)
  const confirmClose = useCallback(() => {
    // Clear auto-save timer to prevent saving
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setShowCloseDialog(false);
    navigate(-1);
  }, [navigate]);

  // Cancel close (continue editing)
  const cancelClose = useCallback(() => {
    setShowCloseDialog(false);
  }, []);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        // Save any unsaved changes on unmount
        if (initialContent && initialContent !== lastSavedContentRef.current) {
          handleSave(initialContent);
        }
      }
    };
  }, [initialContent, eventSpecialId]);

  // Handle browser/tab close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && initialContent !== lastSavedContentRef.current) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, initialContent]);

  // Error or Not Found State
  if (isNotFound || error) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[999999] w-screen h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-white w-[450px] p-8 flex flex-col items-center gap-6 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            {/* Error Icon */}
            <div className="w-16 h-16 bg-red-50 border border-red-200 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-900 mb-2">
                Unable to Load Event
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {error ||
                  "The event you're looking for could not be found or is no longer available."}
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 px-4 py-2.5 bg-zinc-100 text-zinc-700 font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 bg-[#056daa] text-white font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Main Editor View
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999999] w-screen h-screen bg-white select-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 z-[999999] w-screen h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="bg-white w-[400px] h-[300px] flex flex-col items-center justify-center gap-4 shadow-2xl"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <SpiralLoader />
                <p className="text-sm font-medium pt-2 text-zinc-600 mt-4">
                  Loading event data...
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          isOpen={showCloseDialog}
          onConfirm={confirmClose}
          onCancel={cancelClose}
          isSaving={isSaving}
        />

        {/* Editor Container */}
        <div className="w-full h-full relative">
          <Editor
            onChange={onChange}
            isSaving={isSaving}
            initialContent={minutesData}
            title={eventData?.eventName || ""}
            handleSave={handleSave}
            handleClose={handleClose}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ShowEditor;