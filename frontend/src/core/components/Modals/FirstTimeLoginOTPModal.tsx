import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

interface FirstTimeLoginOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string, userId: string, signature: string) => void;
}

const FirstTimeLoginOTPModal: React.FC<FirstTimeLoginOTPModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    checkEmailForFirstLogin,
    sendFirstLoginOTP,
    resendFirstLoginOTP,
    verifyFirstLoginOTP,
  } = useAuth();
  const { showError, showWarning, showSuccess, showInfo } = useToast();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [step, setStep] = useState<"email" | "totp" | "success">("email");
  const [currentUserId, setCurrentUserId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");

  const cityHallImage = "/cok_hall.jpg";
  const logoImage = "/LOGO_COK.png";

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setEmail("");
        setOtp(["", "", "", "", "", ""]);
        setTimeLeft(300);
        setError("");
        setSuccess(false);
        setStep("email");
        setCurrentUserId("");
        setQrCode("");
        setSecret("");
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "totp" && timeLeft > 0 && !success) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, success]);

  const handleSendOTP = async () => {
    if (!email) {
      showWarning("Please enter your email");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const checkResult = await checkEmailForFirstLogin(email);

      if (checkResult.data?.alreadyActivated) {
        showWarning(
          checkResult.message ||
            "This account is already active. Please use regular login.",
        );
        setIsLoading(false);
        return;
      }

      if (!checkResult.status) {
        showError(
          checkResult.message || checkResult.error || "Failed to verify email",
        );
        setIsLoading(false);
        return;
      }

      showSuccess(checkResult.message || "Email verified. Setting up 2FA...");

      const otpResult = await sendFirstLoginOTP(email);

      if (otpResult.status && otpResult.data?.userId) {
        setCurrentUserId(otpResult.data.userId);
        setQrCode(otpResult.data.qrCode || "");
        setSecret(otpResult.data.secret || "");
        setStep("totp");
        showSuccess(
          otpResult.message ||
            "TOTP setup generated! Please scan the QR code with your authenticator app.",
        );
      } else {
        showError(otpResult.message || otpResult.error || "Failed to setup 2FA");
      }
    } catch (err: any) {
      console.log("000000", err)
      const errorMessage =
        err?.message || err?.error || "Failed to setup 2FA. Please try again.";

      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-firsttime-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-firsttime-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    const newOtp = [...otp];
    pastedData.forEach((value, index) => {
      if (index < 6) newOtp[index] = value;
    });
    setOtp(newOtp);
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      showWarning("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await verifyFirstLoginOTP(currentUserId, otpString);

      if (result.status && result.data?.signature) {
        showSuccess("TOTP verified successfully! Setting up your account...");
        if (onSuccess) {
          onSuccess(email, currentUserId, result.data.signature);
        }
      } else {
        showError(
          result.message || result.error || "Invalid TOTP. Please try again.",
        );
      }
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.error || "Failed to verify TOTP. Please try again.";
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!currentUserId) {
      showWarning("Please enter your email first");
      return;
    }

    setIsResending(true);
    setError("");

    try {
      await resendFirstLoginOTP(email, currentUserId);
      setTimeLeft(300);
      showSuccess("New TOTP setup generated! Please scan the QR code with your authenticator app.");
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.error || "Failed to resend 2FA setup. Please try again.";
      showError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const maskEmail = (emailStr: string) => {
    if (!emailStr) return "";
    const [localPart, domain] = emailStr.split("@");
    if (!domain) return emailStr;

    const maskedLocal =
      localPart.length > 2
        ? localPart.substring(0, 2) + "***"
        : localPart + "***";

    return `${maskedLocal}@${domain}`;
  };

  const copyToClipboard = (text: string, label: string = 'Secret') => {
    navigator.clipboard.writeText(text).then(() => {
      showInfo(`${label} copied to clipboard`);
    }).catch(() => {
      showError('Failed to copy to clipboard');
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cityHallImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
      </div>

      <div className="flex min-h-full items-center justify-center p-2 sm:p-3 md:p-4">
        <div className="relative bg-white/95 backdrop-blur-sm shadow-2xl max-w-sm w-full p-4 sm:p-5 md:p-6 transform transition-all">
          {(success || step === "success") ? (
            <div className="text-center py-6 sm:py-8">
              <div className="mx-auto flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-green-100 mb-3 sm:mb-4">
                <svg
                  className="h-7 w-7 sm:h-8 sm:w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Verification Successful!
              </h3>
              <p className="text-sm sm:text-base text-gray-600">Redirecting to password setup...</p>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="flex justify-center mb-3">
                <img
                  src={logoImage}
                  alt="City of Kigali"
                  className="h-12 w-auto sm:h-14 md:h-16"
                />
              </div>

              <h1 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#056daa] mb-1" style={{ fontWeight: 700 }}>
                Account Activation
              </h1>

              {step === "email" && (
                <>
                  <p className="text-center text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm">
                    Please enter your registered email to Set-up Authenticator
                  </p>

                  <div className="mb-4 sm:mb-6">
                    <label
                      htmlFor="firsttime-email"
                      className="block text-xs sm:text-sm font-medium text-gray-700 mb-1"
                    >
                      Email Address
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 sm:pl-3 text-[#9CA3AF]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </span>
                      <form onSubmit={(e)=> {
                        e.preventDefault();
                        handleSendOTP();
                      }}>
                        <input
                        id="firsttime-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="cok-auth-input pl-8 sm:pl-10 pr-3 py-2.5 sm:py-3 placeholder:text-gray-400 text-sm sm:text-base"
                        placeholder="e.g user@domain.example"
                      />
                      </form>
                    </div>
                  </div>

                  {error && (
                    <p className="text-center text-xs sm:text-sm text-red-600 mb-3 sm:mb-4">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={isLoading || !email}
                    className="w-full cok-btn-primary disabled:cursor-not-allowed text-xs sm:text-sm py-2.5 sm:py-3"
                  >
                    {isLoading ? "Verifying..." : "verify email"}
                  </button>
                </>
              )}

              {step === "totp" && (
                <>
                  <p className="text-center text-gray-600 mb-3 sm:mb-4 text-xs sm:text-sm">
                    Please scan the QR code with your authenticator app (Google
                    Authenticator, Authy, etc.) and enter the 6-digit code
                    <br />
                    <span className="font-semibold text-gray-900">
                      {maskEmail(email)}
                    </span>
                  </p>

                  {qrCode && (
                    <div className="flex justify-center mb-3">
                      <img
                        src={qrCode}
                        alt="TOTP QR Code"
                        className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 border border-gray-200 rounded-lg"
                      />
                    </div>
                  )}

                  {secret && (
                    <div className="text-center mb-3 sm:mb-4">
                      <p className="text-xs text-gray-500 mb-1 sm:mb-2">
                        Can't scan? Enter this secret manually click to copy:
                      </p>
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <code
                          onClick={() => copyToClipboard(secret)}
                          className="text-xs sm:text-sm cursor-pointer bg-white px-2 py-1 rounded hover:bg-gray-100 transition-colors select-all"
                          title="Click to copy"
                        >
                          {secret?.slice(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(secret)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy secret to clipboard"
                        >
                          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6"
                    onPaste={handlePaste}
                  >
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-firsttime-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) =>
                          handleOtpChange(
                            index,
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-center text-base sm:text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-center text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                    • Code refreshes every 30 seconds
                  </p>

                  {error && (
                    <p className="text-center text-xs sm:text-sm text-red-600 mb-3 sm:mb-4">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleVerify}
                    disabled={otp.join("").length !== 6 || isLoading}
                    className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-3 sm:mb-4 text-xs sm:text-sm py-2.5 sm:py-3"
                  >
                    {isLoading ? "Verifying..." : "Continue to Password Setup"}
                  </button>
                </>
              )}

              <div className="text-center mt-4 sm:mt-6">
                <button
                  onClick={onClose}
                  className="cok-btn-outlined w-full text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  Back to Login
                </button>
              </div>

              <p className="text-left text-xs text-gray-400 mt-4 sm:mt-5">
                © CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstTimeLoginOTPModal;