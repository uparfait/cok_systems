import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../core/contexts/ToastContext";
import { verifyPhone, submitFeedback, submitUnservicedFeedback, getFeedbackByPhone } from "../core/services/feedbackService";
import { FiPhone, FiCheckCircle, FiAlertCircle, FiMessageSquare, FiEye } from "react-icons/fi";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: NEUTRAL_DARK,
};

function FeedbackForm({ type = "serviced" }) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const isServiced = type === "serviced";

  const [phone, setPhone] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [existingFeedback, setExistingFeedback] = useState({});

  const [unservedName, setUnservedName] = useState("");
  const [unservedPhone, setUnservedPhone] = useState("");
  const [unservedRating, setUnservedRating] = useState(0);
  const [unservedMessage, setUnservedMessage] = useState("");

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [step, setStep] = useState(isServiced ? "phone" : "unserviced_rate");

  const rateButtons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const renderRating = (value, onChange) => (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {rateButtons.map((num) => {
        const selected = value === num;
        return (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className="w-10 h-10 rounded-full text-sm font-medium transition-colors flex-shrink-0"
            style={{
              backgroundColor: selected ? "rgba(5,109,170,0.08)" : WHITE,
              borderColor: selected ? PRIMARY : BORDER,
              color: selected ? PRIMARY : NEUTRAL_DARK,
              borderWidth: 1,
              borderStyle: "solid",
            }}
          >
            {num}
          </button>
        );
      })}
    </div>
  );

  const handleVerifyPhone = async () => {
    if (!phone.trim()) {
      setPhoneError("Please enter your phone number");
      return;
    }
    setIsVerifying(true);
    setErrorMessage("");
    try {
      const response = await verifyPhone(phone.trim());
      setVisitorName(response.visitor_name);
      setDepartments(response.assigned_departments || []);
      if (response.assigned_departments && response.assigned_departments.length === 0) {
        setErrorMessage("No departments assigned to this phone number");
        setStep("error");
      } else {
        loadExistingFeedback(phone.trim());
        setStep("department");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Phone number not found"
      );
      setStep("error");
    } finally {
      setIsVerifying(false);
    }
  };

  const loadExistingFeedback = async (telephone) => {
    try {
      const result = await getFeedbackByPhone(telephone);
      const feedbackMap = {};
      result.feedback.forEach((fb) => {
        feedbackMap[fb.department_id] = fb;
      });
      setExistingFeedback(feedbackMap);
    } catch {
      setExistingFeedback({});
    }
  };

  const handleSelectDepartment = (dept) => {
    if (existingFeedback[dept.department_id]) {
      setErrorMessage(
        `Feedback already submitted for ${dept.department_name}. Rating: ${existingFeedback[dept.department_id].rate}/10. You can only provide feedback once per department.`
      );
      setStep("error");
      return;
    }
    setSelectedDepartment(dept);
    setStep("rate");
  };

  const handleSubmit = async () => {
    if (!selectedDepartment) return;
    setIsSubmitting(true);
    try {
      await submitFeedback({
        telephone: phone,
        department_id: selectedDepartment.department_id,
        rate: rating,
        textmessage: message.trim() || undefined,
      });
      setStep("success");
      showSuccess("Thank you! Your feedback has been submitted successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to submit feedback"
      );
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnservicedSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitUnservicedFeedback({
        telephone: unservedPhone || undefined,
        user_name: unservedName || undefined,
        rate: unservedRating,
        textmessage: unservedMessage.trim() || undefined,
      });
      setStep("success");
      showSuccess("Thank you! Your feedback has been submitted successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to submit feedback"
      );
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    if (step === "phone" || step === "unserviced_rate") {
      navigate("/feedback");
      return;
    }
    if (step === "department") setStep("phone");
    else if (step === "rate") setStep("department");
    else if (step === "preview") setStep("rate");
    else if (step === "error") setStep(isServiced ? "phone" : "unserviced_rate");
    else if (step === "unserviced_preview") setStep("unserviced_rate");
  };

  const handlePreview = () => setStep("preview");
  const handleUnservicedPreview = () => setStep("unserviced_preview");

  return (
    <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT, minHeight: "100%" }}>
      <div className="max-w-2xl mx-auto pt-6">
        <div className="p-4 sm:p-6" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
          <form className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold" style={{ fontFamily: fontHeading, color: PRIMARY }}>
                  {step === "success" ? "Feedback Submitted" : "Submit Feedback"}
                </h2>
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="text-sm font-semibold"
                  style={{ fontFamily: fontHeading, color: PRIMARY }}
                >
                  Back to feedback type
                </button>
              </div>

              {/* Step: Phone (Serviced) */}
              {step === "phone" && isServiced && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center" style={{ color: PRIMARY }}>
                      <FiPhone className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      Enter Your Phone Number
                    </p>
                    <p className="text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      Use the phone number from your service visit
                    </p>
                  </div>

                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: NEUTRAL_DARK }}>
                        <FiPhone className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                        placeholder="Enter phone number"
                        className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base pl-10"
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyPhone()}
                      />
                    </div>
                    {phoneError && (
                      <p className="mt-1 text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{phoneError}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyPhone}
                    disabled={isVerifying || !phone.trim()}
                    className="w-full cok-btn-primary py-2.5 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {isVerifying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              )}

              {/* Step: Department (Serviced) */}
              {step === "department" && isServiced && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center" style={{ color: PRIMARY }}>
                      <FiCheckCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      Welcome, {visitorName}
                    </p>
                    <p className="text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      Select a department to rate
                    </p>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {departments.map((dept) => {
                      const hasFeedback = existingFeedback[dept.department_id];
                      return (
                        <button
                          key={dept.department_id}
                          type="button"
                          onClick={() => handleSelectDepartment(dept)}
                          disabled={!!hasFeedback}
                          className="w-full p-3 text-left transition-colors flex items-center justify-between"
                          style={{
                            backgroundColor: hasFeedback ? "rgba(5,109,170,0.08)" : WHITE,
                            borderColor: hasFeedback ? PRIMARY : BORDER,
                            borderWidth: 1,
                            borderStyle: "solid",
                            cursor: hasFeedback ? "default" : "pointer",
                            opacity: hasFeedback ? 0.8 : 1,
                          }}
                        >
                          <div>
                            <p className="font-medium text-sm" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                              {dept.department_name}
                            </p>
                            <p className="text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                              Provider: {dept.provider_name}
                            </p>
                          </div>
                          {hasFeedback && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold" style={{ color: PRIMARY, backgroundColor: "rgba(5,109,170,0.08)", border: `1px solid ${PRIMARY}` }}>
                              Done
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step: Rate (Serviced) */}
              {step === "rate" && isServiced && selectedDepartment && (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      {selectedDepartment.department_name}
                    </p>
                    <p className="text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      Rate your experience
                    </p>
                  </div>

                  <div>
                    <label style={labelStyle}>Rating: {rating}/10</label>
                    {renderRating(rating, setRating)}
                    <div className="flex justify-between text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Your Feedback (Optional)</label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                      placeholder="Tell us about your experience..."
                      className="w-full cok-auth-input resize-y pl-3 pt-2"
                      style={{ backgroundColor: WHITE, color: NEUTRAL_DARK, borderColor: BORDER, borderWidth: 2, borderStyle: "solid", fontFamily: fontHeading, fontSize: "14px" }}
                    />
                    <p className="text-xs text-right" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      {message.length}/500
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("department")}
                      className="flex-1 cok-btn-outlined py-2.5 text-sm sm:text-base"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handlePreview}
                      className="flex-1 cok-btn-primary py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <FiEye className="w-4 h-4" />
                      Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Preview (Serviced) */}
              {step === "preview" && isServiced && selectedDepartment && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center" style={{ color: PRIMARY }}>
                      <FiMessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      Preview Your Feedback
                    </p>
                  </div>

                  <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Department</span>
                      <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                        {selectedDepartment.department_name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Provider</span>
                      <span className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{selectedDepartment.provider_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Rating</span>
                      <span className="text-sm font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{rating}/10</span>
                    </div>
                    {message && (
                      <div>
                        <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Message</span>
                        <p className="text-sm mt-1 italic" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                          "{message}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("rate")}
                      disabled={isSubmitting}
                      className="flex-1 cok-btn-outlined py-2.5 disabled:opacity-50 text-sm sm:text-base"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 cok-btn-primary py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          Submit Feedback
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Rate (Unserviced) */}
              {step === "unserviced_rate" && !isServiced && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center" style={{ color: PRIMARY }}>
                      <FiMessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      Share Your Feedback
                    </p>
                    <p className="text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      No service required - tell us about your experience
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Name (Optional)</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: NEUTRAL_DARK }}>
                          <FiUser className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={unservedName}
                          onChange={(e) => setUnservedName(e.target.value.slice(0, 200))}
                          placeholder="Enter your name"
                          className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Phone (Optional)</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: NEUTRAL_DARK }}>
                          <FiPhone className="w-4 h-4" />
                        </span>
                        <input
                          type="tel"
                          value={unservedPhone}
                          onChange={(e) => setUnservedPhone(e.target.value)}
                          placeholder="Phone number"
                          className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Rating: {unservedRating}/10</label>
                    {renderRating(unservedRating, setUnservedRating)}
                    <div className="flex justify-between text-xs" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Your Feedback (Optional)</label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={unservedMessage}
                      onChange={(e) => setUnservedMessage(e.target.value.slice(0, 500))}
                      placeholder="Tell us about your experience..."
                      className="w-full cok-auth-input resize-y pl-3 pt-2"
                      style={{ backgroundColor: WHITE, color: NEUTRAL_DARK, borderColor: BORDER, borderWidth: 2, borderStyle: "solid", fontFamily: fontHeading, fontSize: "14px" }}
                    />
                    <p className="text-xs text-right" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      {unservedMessage.length}/500
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="flex-1 cok-btn-outlined py-2.5 text-sm sm:text-base"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleUnservicedPreview}
                      className="flex-1 cok-btn-primary py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <FiEye className="w-4 h-4" />
                      Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Preview (Unserviced) */}
              {step === "unserviced_preview" && !isServiced && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center" style={{ color: PRIMARY }}>
                      <FiMessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      Preview Your Feedback
                    </p>
                  </div>

                  <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                    {(unservedName || unservedPhone) && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>From</span>
                        <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                          {unservedName}
                          {unservedName && unservedPhone ? " | " : ""}
                          {unservedPhone}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Type</span>
                      <span className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>General Feedback</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Rating</span>
                      <span className="text-sm font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{unservedRating}/10</span>
                    </div>
                    {unservedMessage && (
                      <div>
                        <span className="text-xs uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Message</span>
                        <p className="text-sm mt-1 italic" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                          "{unservedMessage}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("unserviced_rate")}
                      disabled={isSubmitting}
                      className="flex-1 cok-btn-outlined py-2.5 disabled:opacity-50 text-sm sm:text-base"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleUnservicedSubmit}
                      disabled={isSubmitting}
                      className="flex-1 cok-btn-primary py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Feedback"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Success */}
              {step === "success" && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ color: PRIMARY }}>
                    <FiCheckCircle className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Thank You!</p>
                  <p className="text-sm mt-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    Your feedback has been submitted successfully.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/feedback")}
                    className="mt-5 w-full cok-btn-primary py-2.5 text-sm sm:text-base"
                  >
                    Back to Feedback
                  </button>
                </div>
              )}

              {/* Error */}
              {step === "error" && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ color: PRIMARY }}>
                    <FiAlertCircle className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{errorMessage || "Unable to Submit"}</p>
                  <p className="text-xs mt-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    Note: You can only submit feedback for departments you were assigned to during your visit.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoBack}
                    className="mt-5 w-full cok-btn-primary py-2.5 text-sm sm:text-base"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
  );
}

export default FeedbackForm;
