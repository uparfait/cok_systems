import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { FiMail, FiLock, FiX } from "react-icons/fi";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#248fc2";
const PRIMARY_DARK = "#033b5c";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const DANGER = "#E53935";

const inputBaseStyle = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '0.2px',
  lineHeight: '1.4',
  width: '100%',
  padding: '12px 1rem 12px 2.5rem',
  color: NEUTRAL_DARK,
  backgroundColor: NEUTRAL_LIGHT,
  borderRadius: 0,
  border: '1px solid transparent',
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  outline: 'none',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const inputFocusStyle = {
  borderColor: PRIMARY,
  boxShadow: `0px 4px 8px rgba(52, 168, 219, 0.25)`,
};

const primaryBtnStyle = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  lineHeight: '1.4',
  textTransform: 'uppercase',
  textAlign: 'center',
  width: '100%',
  cursor: 'pointer',
  borderRadius: 0,
  border: 0,
  padding: '0.9rem',
  backgroundColor: PRIMARY,
  color: '#FFFFFF',
  transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease',
};

const outlinedBtnStyle = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  lineHeight: '1.4',
  textTransform: 'uppercase',
  textAlign: 'center',
  width: '100%',
  cursor: 'pointer',
  borderRadius: 0,
  border: `1px solid ${PRIMARY}`,
  padding: '0.9rem',
  backgroundColor: 'transparent',
  color: PRIMARY,
  transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease',
};

export default function EventAccessOverlay({ event, isOpen, onVerified, onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail("");
      setToken("");
      setError("");
      setEmailFocused(false);
      setTokenFocused(false);
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
      setError(err.response?.data?.message || "Something went wrong");
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
      setError(err.response?.data?.message || "Something went wrong");
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
      setError(err.response?.data?.message || "Something went wrong");
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
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-md bg-white shadow-2xl relative"
            style={{ borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 p-2 transition-colors"
              style={{ color: PRIMARY, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY_DARK; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="p-6 border-b" style={{ borderColor: "#E0E0E0" }}>
              <h2 className="text-lg font-bold uppercase tracking-wide" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                {step === "email" ? "Enter Organizer Email" : "Enter Access Token"}
              </h2>
              <p className="text-xs mt-1 text-zinc-500">
                {step === "email"
                  ? "Provide the organizer email to receive a verification token."
                  : "Check your email and enter the token below."}
              </p>
            </div>

            <form onSubmit={step === "email" ? handleEmailSubmit : handleTokenSubmit} className="p-6 space-y-4">
              {step === "email" ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="organizer@example.com"
                      required
                      className="w-full pr-4 py-3 text-sm outline-none"
                      style={{
                        ...inputBaseStyle,
                        ...(emailFocused ? inputFocusStyle : {}),
                      }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                    Access Token
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} />
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      required
                      className="w-full pr-4 py-3 text-sm outline-none tracking-widest uppercase"
                      style={{
                        ...inputBaseStyle,
                        ...(tokenFocused ? inputFocusStyle : {}),
                      }}
                      onFocus={() => setTokenFocused(true)}
                      onBlur={() => setTokenFocused(false)}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs font-medium" style={{ color: DANGER }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                {step === "token" && (
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setError(""); }}
                    className="flex-1 py-3"
                    style={outlinedBtnStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = PRIMARY;
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = PRIMARY;
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 disabled:opacity-60"
                  style={primaryBtnStyle}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                  onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(1px)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {loading ? "Please wait..." : step === "email" ? "Send Token" : "Verify"}
                </button>
              </div>

              {step === "token" && (
                <button
                  type="button"
                  onClick={handleResendToken}
                  disabled={resendLoading}
                  className="w-full py-3 disabled:opacity-60"
                  style={outlinedBtnStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PRIMARY;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = PRIMARY;
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {resendLoading ? "Sending..." : "Resend Token"}
                </button>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
