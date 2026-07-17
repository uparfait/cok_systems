import { FiX, FiSave } from "react-icons/fi";
import CreateEventStepper from "../../../components/CreateEventStepper";
import ActivityAgenda from "../../../components/sub-components/ActivityAgenda";
import EditRoomSelector from "./EditRoomSelector";
import SystemAlert from "@/core/components/SystemAlert";

import {
  PRIMARY, PRIMARY_HOVER, DANGER, NEUTRAL_LIGHT, NEUTRAL_DARK, BORDER, WHITE, GRAY_DISABLED, fontHeading,
  FOCUS_SHADOW, BLUR_SHADOW, inputStyle, labelStyle, getBtnStyle, btnHover, btnLeavePrimary,
} from "./TrackShared";

export default function TrackEditForm({
  editForm, setEditForm, editFieldErrors, setEditFieldErrors, editStep, setEditStep,
  completedSteps, setCompletedSteps, maxSteps, showAgenda, loading, requestId,
  systemAlert, setSystemAlert, onCancel, onSave,
}) {
  function validate(step) {
    const errs = {};
    if (step === 1) {
      if (!editForm.eventName?.trim()) errs.eventName = "Event name is required";
      if (!editForm.eventType) errs.eventType = "Please select an event type";
      if (!editForm.audience || Number(editForm.audience) < 1) errs.audience = "Expected audience is required";
      if (!editForm.eventDescription?.trim()) errs.eventDescription = "Description is required";
    } else if (step === 2) {
      if (!editForm.organizerNames?.trim()) errs.organizerNames = "Full names are required";
      if (!editForm.organizerEmail?.trim()) errs.organizerEmail = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.organizerEmail.trim())) errs.organizerEmail = "Enter a valid email address";
      if (!editForm.organizerPhone?.trim()) errs.organizerPhone = "Phone number is required";
    } else if (step === 3) {
      if (!editForm.startTime) errs.startTime = "Start time is required";
      if (!editForm.endTime) errs.endTime = "End time is required";
      else if (editForm.startTime && new Date(editForm.endTime) <= new Date(editForm.startTime)) errs.endTime = "End time must be after start time";
    } else if (step === 4) {
      if (!editForm.eventRoom?.trim()) errs.eventRoom = "Please select a room";
    }
    setEditFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    if (name) {
      setEditForm((prev) => ({ ...prev, [name]: value }));
      if (editFieldErrors[name]) setEditFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  }

  function handleEditNext() {
    let valid = false;
    if (editStep === 1 && validate(1)) valid = true;
    else if (editStep === 2 && validate(2)) valid = true;
    else if (editStep === 3 && validate(3)) valid = true;
    else if (editStep === 4 && validate(4)) valid = true;
    if (valid) {
      setCompletedSteps((prev) => (prev.includes(editStep) ? prev : [...prev, editStep]));
      setEditStep((s) => Math.min(maxSteps, s + 1));
    }
  }
  function handleEditBack() { setEditFieldErrors({}); setEditStep((s) => Math.max(1, s - 1)); }
  function handleEditStepClick(targetStep) {
    if (completedSteps.includes(targetStep) || targetStep < editStep) { setEditFieldErrors({}); setEditStep(targetStep); }
  }

  return (
    <div className="w-full" style={{ maxWidth: '800px', margin: '24px auto 0' }}>
      <div className="px-6 py-6 text-white mb-0" style={{ backgroundColor: PRIMARY }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <FiSave className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-extrabold leading-tight" style={{ fontFamily: fontHeading, letterSpacing: '-0.5px' }}>
            {editForm.eventMeetingType === "meet" ? "Edit Meeting Room" : "Edit Event Room"}</h1>
        </div>
      </div>

      <CreateEventStepper currentStep={editStep} eventMeetingType={editForm.eventMeetingType} onStepClick={handleEditStepClick} completedSteps={completedSteps} />

      <div className="p-6 space-y-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderTop: '0' }}>
        <SystemAlert isOpen={systemAlert.isOpen} type={systemAlert.type} message={systemAlert.message} onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))} />

        {editStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label style={labelStyle}>{editForm.eventMeetingType === "meet" ? "Meeting" : "Event"} Name <span style={{ color: DANGER }}>*</span></label>
              <input style={{ ...inputStyle, borderColor: editFieldErrors.eventName ? DANGER : BORDER }}
                value={editForm.eventName} name="eventName" onChange={handleEditChange}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.eventName ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              {editFieldErrors.eventName && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.eventName}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>{editForm.eventMeetingType === "meet" ? "Meeting" : "Event"} Type <span style={{ color: DANGER }}>*</span></label>
              <select style={{ ...inputStyle, borderColor: editFieldErrors.eventType ? DANGER : BORDER }}
                value={editForm.eventType} name="eventType" onChange={handleEditChange}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.eventType ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }}>
                <option value="">Select type</option><option value="Internal">Internal</option><option value="Joint">Joint</option><option value="External">External</option>
              </select>
              {editFieldErrors.eventType && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.eventType}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>Expected Audience <span style={{ color: DANGER }}>*</span></label>
              <input style={{ ...inputStyle, borderColor: editFieldErrors.audience ? DANGER : BORDER }} type="number"
                value={editForm.audience} name="audience" onChange={handleEditChange} min={1}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.audience ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              {editFieldErrors.audience && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.audience}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', borderColor: editFieldErrors.eventDescription ? DANGER : BORDER }}
                value={editForm.eventDescription} name="eventDescription" onChange={handleEditChange} rows={3}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.eventDescription ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              {editFieldErrors.eventDescription && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.eventDescription}</p>}
            </div>
          </div>
        )}
        {editStep === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label style={labelStyle}>Full Names <span style={{ color: DANGER }}>*</span></label>
                <input style={{ ...inputStyle, borderColor: editFieldErrors.organizerNames ? DANGER : BORDER }}
                  value={editForm.organizerNames} name="organizerNames" onChange={handleEditChange}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.organizerNames ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
                {editFieldErrors.organizerNames && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.organizerNames}</p>}
              </div>
              <div className="space-y-1.5">
                <label style={labelStyle}>Institution <span className="text-xs ml-1" style={{ color: GRAY_DISABLED }}>(optional)</span></label>
                <input style={{ ...inputStyle, borderColor: BORDER }}
                  value={editForm.organizerInstitution} name="organizerInstitution" onChange={handleEditChange}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label style={labelStyle}>Email <span style={{ color: DANGER }}>*</span></label>
                <input style={{ ...inputStyle, borderColor: editFieldErrors.organizerEmail ? DANGER : BORDER }} type="email"
                  value={editForm.organizerEmail} name="organizerEmail" onChange={handleEditChange}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.organizerEmail ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
                {editFieldErrors.organizerEmail && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.organizerEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <label style={labelStyle}>Phone <span style={{ color: DANGER }}>*</span></label>
                <input style={{ ...inputStyle, borderColor: editFieldErrors.organizerPhone ? DANGER : BORDER }} type="tel"
                  value={editForm.organizerPhone} name="organizerPhone" onChange={handleEditChange}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.organizerPhone ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
                {editFieldErrors.organizerPhone && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.organizerPhone}</p>}
              </div>
            </div>
          </div>
        )}
        {editStep === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label style={labelStyle}>Start <span style={{ color: DANGER }}>*</span></label>
              <input style={{ ...inputStyle, borderColor: editFieldErrors.startTime ? DANGER : BORDER }} type="datetime-local"
                value={editForm.startTime} name="startTime" onChange={handleEditChange}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.startTime ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              {editFieldErrors.startTime && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.startTime}</p>}
            </div>
            <div className="space-y-1.5">
              <label style={labelStyle}>End <span style={{ color: DANGER }}>*</span></label>
              <input style={{ ...inputStyle, borderColor: editFieldErrors.endTime ? DANGER : BORDER }} type="datetime-local"
                value={editForm.endTime} name="endTime" onChange={handleEditChange}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = editFieldErrors.endTime ? DANGER : BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              {editFieldErrors.endTime && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{editFieldErrors.endTime}</p>}
            </div>
          </div>
        )}
        {editStep === 4 && (
          <EditRoomSelector editForm={editForm} setEditForm={setEditForm} requestId={requestId} errors={editFieldErrors} onBack={handleEditBack} />
        )}
        {editStep === 5 && showAgenda && (
          <ActivityAgenda agenda={editForm.agenda} onChange={(agenda) => setEditForm((p) => ({ ...p, agenda }))}
            eventStartTime={editForm.startTime ? editForm.startTime.split("T")[1]?.substring(0, 5) : null}
            eventEndTime={editForm.endTime ? editForm.endTime.split("T")[1]?.substring(0, 5) : null} />
        )}
        {editStep === 5 && !showAgenda && (
          <div className="p-4 text-center" style={{ backgroundColor: '#E3F2FD', border: `1px solid ${BORDER}` }}>
            <p className="text-sm font-medium" style={{ color: PRIMARY, fontFamily: fontHeading }}>No agenda required</p>
            <p className="text-xs mt-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>External events do not require an activity agenda.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '20px' }}>
          <button type="button" onClick={onCancel}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
            style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading, borderRadius: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}>
            <FiX className="w-4 h-4" /> Cancel
          </button>
          {editStep > 1 && (
            <button type="button" onClick={handleEditBack} style={getBtnStyle('outline')}>Back</button>
          )}
          {editStep < maxSteps && (
            <button type="button" onClick={handleEditNext} style={{ ...getBtnStyle('primary'), flex: 1 }}>Next</button>
          )}
          {editStep === maxSteps && (
            <button type="button" onClick={onSave} disabled={loading} style={getBtnStyle('primary', loading)}
              onMouseEnter={(e) => { if (!loading) btnHover(e, PRIMARY_HOVER); }}
              onMouseLeave={(e) => btnLeavePrimary(e)}>
              {loading ? (<><div style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }} />Saving...</>) : (<><FiSave style={{ width: 16, height: 16 }} /> Save Changes</>)}
            </button>
          )}
        </div>
        <p className="text-center text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
      </div>
    </div>
  );
}
