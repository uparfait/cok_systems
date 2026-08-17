import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { FiMail, FiLock, FiX, FiSend } from "react-icons/fi";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const fontHeading = "'Montserrat', sans-serif";

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: NEUTRAL_DARK,
  display: "block",
  marginBottom: "6px",
};

export default function EventAccessOverlay({ event, isOpen, onVerified, onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail("");
      setToken("");
      setError("");
    }
  }, [isOpen]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/cok/api/v1/event-access/request-token", {
        eventSpecialId: event.eventSpecialId,
        email,
      });
      if (res.data?.success) {
        setStep("token");
      } else {
        setError(res.data?.message || "Failed to send token");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/cok/api/v1/event-access/verify-token", {
        eventSpecialId: event.eventSpecialId,
        email,
        token,
      });
      if (res.data?.success) {
        const { accessToken } = res.data.data;
        localStorage.setItem(`event_access_${event.eventSpecialId}`, accessToken);
        onVerified?.(accessToken);
      } else {
        setError(res.data?.message || "Invalid token");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResendToken = async () => {
    setResendLoading(true);
    setError("");
    try {
      const res = await axios.post("/cok/api/v1/event-access/request-token", {
        eventSpecialId: event.eventSpecialId,
        email,
      });
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to resend token");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <div className="min-w-0">
                <h2
                  className="text-base sm:text-lg font-bold"
                  style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                >
                  {step === "email" ? "Organizer Verification" : "Enter Access Token"}
                </h2>
                <p className="text-xs sm:text-sm mt-1" style={{ color: "#9E9E9E" }}>
                  {step === "email"
                    ? "Provide the organizer email to receive a verification token."
                    : `A token was sent to ${email}. Enter it below.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading || resendLoading}
                className="p-1.5 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                style={{ color: "#9E9E9E" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = NEUTRAL_DARK; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#9E9E9E"; }}
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={step === "email" ? handleEmailSubmit : handleTokenSubmit}
              className="px-4 sm:px-6 py-5 space-y-4"
            >
              {step === "email" ? (
                <div>
                  <label style={labelStyle}>
                    Email Address <span style={{ color: DANGER }}>*</span>
                  </label>
                  <div className="relative">
                    <FiMail
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: PRIMARY }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="organizer@example.com"
                      required
                      autoFocus
                      className="w-full cok-auth-input pr-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>
                    Access Token <span style={{ color: DANGER }}>*</span>
                  </label>
                  <div className="relative">
                    <FiLock
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: PRIMARY }}
                    />
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      required
                      autoFocus
                      className="w-full cok-auth-input pr-3 py-2 text-sm tracking-widest uppercase"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  className="p-3 text-xs sm:text-sm"
                  style={{
                    backgroundColor: "#FDECEA",
                    border: "1px solid #F5B7B1",
                    color: DANGER,
                    fontFamily: fontHeading,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {step === "token" && (
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setToken(""); setError(""); }}
                    disabled={loading || resendLoading}
                    className="cok-btn-outlined flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="cok-btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ width: "auto" }}
                >
                  {step === "email" ? (
                    <>
                      <FiSend className="w-4 h-4" />
                      {loading ? "Sending…" : "Send Token"}
                    </>
                  ) : (
                    <>{loading ? "Verifying…" : "Verify"}</>
                  )}
                </button>
              </div>

              {step === "token" && (
                <button
                  type="button"
                  onClick={handleResendToken}
                  disabled={resendLoading || loading}
                  className="cok-btn-outlined w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "Resending…" : "Resend Token"}
                </button>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
