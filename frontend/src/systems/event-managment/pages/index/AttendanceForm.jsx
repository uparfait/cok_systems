import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { FiUploadCloud, FiFileText, FiX } from 'react-icons/fi';
import { useToast } from '@/core/contexts/ToastContext';
import SpiralLoader from '../../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const SUCCESS = '#4CAF50';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';
const inputStyle = { paddingLeft: '12px' };

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
  display: 'block',
  marginBottom: '6px',
};

const responsiveStyles = `
  .cok-attendance-wrap { width: 100%; max-width: 500px; margin: 0 auto; }
  .cok-attendance-form { border: none; }
  @media (min-width: 500px) {
    .cok-attendance-form { border: 1px solid ${BORDER}; }
  }
`;

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e) => {
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* not supported for this pointer */ }
    drawingRef.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    // dot for a single tap
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    if (!hasInkRef.current) { hasInkRef.current = true; setHasInk(true); }
  };

  const handleMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasInkRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasInkRef.current = false;
    setHasInk(false);
    onChange('');
  };

  return (
    <div className="space-y-1.5">
      <div className="relative bg-white" style={{ border: `1px solid ${BORDER}` }}>
        <canvas
          ref={canvasRef}
          className="w-full h-36 block cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {!hasInk && (
          <span className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none select-none" style={{ color: '#C9C9C9' }}>
            Sign here
          </span>
        )}
      </div>
      {hasInk && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium cursor-pointer"
          style={{ color: PRIMARY, fontFamily: fontHeading }}
        >
          Clear signature
        </button>
      )}
    </div>
  );
}

export default function AttendanceForm() {
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useToast();

  // Check if this is a room-based QR scan (RoomOnly=true) or event-based QR scan (has eventSpecialId)
  const isRoomOnly = searchParams.get('RoomOnly') === 'true';

  const [fetchedData, setFetchedData] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [fetchingData, setFetchingData] = useState(false);

  const eventSpecialId = searchParams.get('eventSpecialId') || fetchedData?.eventSpecialId || '';
  const eventName = searchParams.get('eventName') || fetchedData?.eventName || '';
  const eventRoom = searchParams.get('eventRoom') || fetchedData?.eventRoom || '';
  const roomLocation = searchParams.get('roomLocation') || fetchedData?.roomLocation || '';
  const eventType = searchParams.get('eventType') || fetchedData?.eventType || '';
  const roomNameOrEventId = useParams()?.id;

  useEffect(() => {
    if (!isRoomOnly || !roomNameOrEventId) return;

    const fetchRoomLiveEvent = async () => {
      setFetchingData(true);
      setFetchError(null);
      try {
        const res = await axios.get(`${BASE_URL}/events/live`, {
          params: {
            search: roomNameOrEventId.toLowerCase(),
            searchField: 'eventRoom',
            limit: 1,
          },
        });

        if (res.data?.success && res.data.data?.length > 0) {
          const ev = res.data.data[0];
          setFetchedData({
            eventSpecialId: ev.eventSpecialId,
            eventName: ev.eventName,
            eventRoom: ev.eventRoom,
            roomLocation: '',
            eventType: ev.eventType,
          });
        } else {
          setFetchError('No live event currently happening in this room.');
        }
      } catch (err) {
        console.log(err);
        setFetchError(
          err.response?.data?.message ||
          'No live event currently happening in this room.'
        );
      } finally {
        setFetchingData(false);
      }
    };

    fetchRoomLiveEvent();
  }, [roomNameOrEventId, isRoomOnly]);

  const isInternal = eventType?.toLowerCase() === 'internal';

  const emptyForm = {
    attendeeFullName: '',
    attendeeEmail: '',
    attendeePhoneNumber: '',
    attendeeInstitution: isInternal ? 'City of Kigali' : '',
    attendeePosition: '',
  };

  const [formData, setFormData] = useState(emptyForm);
  const [signature, setSignature] = useState('');
  const [signatureMethod, setSignatureMethod] = useState('draw');
  const [certificateFile, setCertificateFile] = useState(null);
  const [certError, setCertError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const successTimerRef = useRef(null);
  const certInputRef = useRef(null);

  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
  }, []);

  const validate = () => {
    const newErrors = {};

    if (!formData.attendeeFullName.trim())
      newErrors.attendeeFullName = 'Full name is required';

    // Email is required for internal meetings, optional otherwise
    if (isInternal && !formData.attendeeEmail.trim()) {
      newErrors.attendeeEmail = 'Email is required for internal meetings';
    } else if (formData.attendeeEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.attendeeEmail.trim()))
        newErrors.attendeeEmail = 'Please enter a valid email address';
    }

    if (!formData.attendeePhoneNumber.trim())
      newErrors.attendeePhoneNumber = 'Phone number is required';

    if (!isInternal && !formData.attendeeInstitution.trim())
      newErrors.attendeeInstitution = 'Institution is required';

    if (!formData.attendeePosition.trim())
      newErrors.attendeePosition = 'Position is required';

    // A signature is required: either drawn or an uploaded digital signature
    if (signatureMethod === 'draw' && !signature)
      newErrors.signature = 'Please draw your signature';
    if (signatureMethod === 'certificate' && !certificateFile)
      newErrors.signature = 'Please upload your digital signature';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (signatureMethod === 'certificate' && certificateFile && certError) return;

    setLoading(true);
    setServerError('');

    try {
      if (signatureMethod === 'certificate' && certificateFile) {
        const payload = new FormData();
        payload.append('attendeeFullName', formData.attendeeFullName.trim());
        payload.append('attendeeEmail', formData.attendeeEmail.trim() || '');
        payload.append('attendeePhoneNumber', formData.attendeePhoneNumber.trim());
        payload.append('attendeeInstitution', isInternal ? 'City of Kigali' : formData.attendeeInstitution.trim());
        payload.append('attendeePosition', formData.attendeePosition.trim());
        payload.append('eventSpecialId', eventSpecialId);
        payload.append('eventName', eventName);
        payload.append('eventRoom', eventRoom);
        payload.append('roomLocation', roomLocation);
        payload.append('signatureMethod', 'certificate');
        if (signature) payload.append('attendeeSignature', signature);
        payload.append('digitalCertificate', certificateFile);

        await axios.post(`${BASE_URL}/attendance`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await axios.post(`${BASE_URL}/attendance`, {
          attendeeFullName: formData.attendeeFullName.trim(),
          attendeeEmail: formData.attendeeEmail.trim() || undefined,
          attendeePhoneNumber: formData.attendeePhoneNumber.trim(),
          attendeeInstitution: isInternal ? 'City of Kigali' : formData.attendeeInstitution.trim(),
          attendeePosition: formData.attendeePosition.trim(),
          eventSpecialId,
          eventName,
          eventRoom,
          roomLocation,
          attendeeSignature: signature || undefined,
          signatureMethod,
        });
      }

      // Success: turn the submit button green, reset the form, revert after 5s
      setSuccess(true);
      showSuccess('Attendance recorded');
      setFormData({ ...emptyForm });
      setSignature('');
      setCertificateFile(null);
      setCertError('');
      setSignatureMethod('draw');
      setErrors({});
      setPadKey((k) => k + 1);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit attendance. Please try again.';
      setServerError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while fetching room data
  if (fetchingData) {
    return (
      <div className="w-full flex items-center justify-center px-4" style={{ paddingTop: '90px' }}>
        <div className="bg-white flex flex-row gap-6 items-center p-8 max-w-sm w-full" style={{ border: `1px solid ${BORDER}` }}>
          <SpiralLoader />
          <span className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
            Searching Event Information...
          </span>
        </div>
      </div>
    );
  }

  // Show fetch error if room-based lookup failed
  if (fetchError) {
    return (
      <div className="w-full flex items-center justify-center px-4" style={{ paddingTop: '90px' }}>
        <div className="bg-white p-8 max-w-sm w-full text-center" style={{ border: `1px solid ${BORDER}` }}>
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FEF5E7' }}>
            <svg className="w-7 h-7" style={{ color: '#F39C12' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
            </svg>
          </div>
          <h2 className="text-base font-bold mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>No Live Event Found</h2>
          <p className="text-sm" style={{ color: GRAY_DISABLED }}>{fetchError}</p>
        </div>
      </div>
    );
  }

  if ((!eventSpecialId && !isRoomOnly)) {
    return (
      <div className="w-full flex items-center justify-center px-4" style={{ paddingTop: '90px' }}>
        <div className="bg-white p-8 max-w-sm w-full text-center" style={{ border: `1px solid ${BORDER}` }}>
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FDECEA' }}>
            <svg className="w-7 h-7" style={{ color: DANGER }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
            </svg>
          </div>
          <h2 className="text-base font-bold mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Invalid Link</h2>
          <p className="text-sm" style={{ color: GRAY_DISABLED }}>This attendance link is missing required event information. Please scan the QR code again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center" style={{ paddingTop: '90px', paddingBottom: '32px' }}>
      <style>{responsiveStyles}</style>
      <div className="cok-attendance-wrap">

        {/* Header: event title + room location only */}
        <div className="px-5 py-4 text-white" style={{ backgroundColor: PRIMARY }}>
          <h1 className="text-base font-bold truncate" style={{ fontFamily: fontHeading }} title={eventName}>
            {eventName}
          </h1>
          {roomLocation && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {roomLocation}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="cok-attendance-form bg-white p-5 sm:p-6 space-y-5" style={{ borderTop: 'none' }}>

          <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
            Fields marked with <span style={{ color: DANGER }}>*</span> are required
          </p>

          {/* Full Name */}
          <div>
            <label htmlFor="attendeeFullName" style={labelStyle}>
              Full Name <span style={{ color: DANGER }}>*</span>
            </label>
            <input
              type="text"
              id="attendeeFullName"
              name="attendeeFullName"
              value={formData.attendeeFullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              autoComplete="name"
              className={inputClassName}
              style={inputStyle}
            />
            {errors.attendeeFullName && (
              <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.attendeeFullName}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="attendeePhoneNumber" style={labelStyle}>
              Phone Number <span style={{ color: DANGER }}>*</span>
            </label>
            <input
              type="tel"
              id="attendeePhoneNumber"
              name="attendeePhoneNumber"
              value={formData.attendeePhoneNumber}
              onChange={handleChange}
              placeholder="e.g. +250 7XX XXX XXX"
              autoComplete="tel"
              className={inputClassName}
              style={inputStyle}
            />
            {errors.attendeePhoneNumber && (
              <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.attendeePhoneNumber}</p>
            )}
          </div>

          {/* Position */}
          <div>
            <label htmlFor="attendeePosition" style={labelStyle}>
              Position / Title <span style={{ color: DANGER }}>*</span>
            </label>
            <input
              type="text"
              id="attendeePosition"
              name="attendeePosition"
              value={formData.attendeePosition}
              onChange={handleChange}
              placeholder="e.g. Software Engineer, Director"
              autoComplete="organization-title"
              className={inputClassName}
              style={inputStyle}
            />
            {errors.attendeePosition && (
              <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.attendeePosition}</p>
            )}
          </div>

          {/* Institution: hidden for internal meetings */}
          {!isInternal && (
            <div>
              <label htmlFor="attendeeInstitution" style={labelStyle}>
                Institution / Organization <span style={{ color: DANGER }}>*</span>
              </label>
              <input
                type="text"
                id="attendeeInstitution"
                name="attendeeInstitution"
                value={formData.attendeeInstitution}
                onChange={handleChange}
                placeholder="e.g. Rwanda Development Board"
                autoComplete="organization"
                className={inputClassName}
                style={inputStyle}
              />
              {errors.attendeeInstitution && (
                <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.attendeeInstitution}</p>
              )}
            </div>
          )}

          {/* Email: required for internal meetings, optional otherwise */}
          <div>
            <label htmlFor="attendeeEmail" style={labelStyle}>
              Email Address{' '}
              {isInternal
                ? <span style={{ color: DANGER }}>*</span>
                : <span className="normal-case font-normal" style={{ color: GRAY_DISABLED }}>(optional)</span>}
            </label>
            <input
              type="email"
              id="attendeeEmail"
              name="attendeeEmail"
              value={formData.attendeeEmail}
              onChange={handleChange}
              placeholder="your.email@example.com"
              autoComplete="email"
              className={inputClassName}
              style={inputStyle}
            />
            {errors.attendeeEmail && (
              <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.attendeeEmail}</p>
            )}
          </div>

          {/* Signature Method: required, sign or upload a digital signature */}
          <div>
            <label style={labelStyle}>
              Signature Method <span style={{ color: DANGER }}>*</span>
            </label>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="signatureMethod"
                  value="draw"
                  checked={signatureMethod === 'draw'}
                  onChange={() => { setSignatureMethod('draw'); setCertificateFile(null); setCertError(''); setErrors((p) => ({ ...p, signature: null })); }}
                  style={{ accentColor: PRIMARY }}
                />
                <span className="text-sm" style={{ color: NEUTRAL_DARK }}>Draw Signature</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="signatureMethod"
                  value="certificate"
                  checked={signatureMethod === 'certificate'}
                  onChange={() => { setSignatureMethod('certificate'); setSignature(''); setErrors((p) => ({ ...p, signature: null })); }}
                  style={{ accentColor: PRIMARY }}
                />
                <span className="text-sm" style={{ color: NEUTRAL_DARK }}>Upload Digital Signature</span>
              </label>
            </div>
          </div>

          {signatureMethod === 'draw' && (
            <div>
              <label style={labelStyle}>
                Draw your signature <span style={{ color: DANGER }}>*</span>
              </label>
              <SignaturePad
                key={padKey}
                onChange={(v) => { setSignature(v); if (v) setErrors((p) => ({ ...p, signature: null })); }}
              />
            </div>
          )}

          {signatureMethod === 'certificate' && (
            <div>
              <label style={labelStyle}>
                Digital Signature <span style={{ color: DANGER }}>*</span>
                <span className="normal-case font-normal ml-1" style={{ color: GRAY_DISABLED }}>(image or PDF, max 5 MB)</span>
              </label>
              <input
                ref={certInputRef}
                type="file"
                id="digitalCertificate"
                name="digitalCertificate"
                accept="image/jpeg,image/png,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                  if (file && !allowedTypes.includes(file.type)) {
                    setCertificateFile(null);
                    setCertError('Invalid file type. Only JPEG, PNG, and PDF are supported.');
                  } else {
                    setCertificateFile(file);
                    setCertError('');
                    if (file) setErrors((p) => ({ ...p, signature: null }));
                  }
                  e.target.value = '';
                }}
              />

              {!certificateFile ? (
                <div
                  onClick={() => certInputRef.current?.click()}
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-6 px-4 text-center transition-colors"
                  style={{ border: '2px dashed #9CC7E4', backgroundColor: '#F7F9FB' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E3F2FD'; e.currentTarget.style.borderColor = PRIMARY; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F7F9FB'; e.currentTarget.style.borderColor = '#9CC7E4'; }}
                >
                  <FiUploadCloud className="w-7 h-7" style={{ color: PRIMARY }} />
                  <p className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    Click to upload your signature
                  </p>
                  <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                    JPEG, PNG or PDF, max 5 MB
                  </p>
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ border: `1px solid ${BORDER}`, backgroundColor: '#F7F9FB' }}
                >
                  <div className="p-2 shrink-0 bg-white" style={{ border: `1px solid ${BORDER}` }}>
                    <FiFileText className="w-4 h-4" style={{ color: PRIMARY }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      {certificateFile.name}
                    </p>
                    <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                      {(certificateFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Remove file"
                    onClick={() => { setCertificateFile(null); setCertError(''); }}
                    className="p-1.5 shrink-0 cursor-pointer transition-colors hover:bg-[#FDECEA]"
                    style={{ color: DANGER }}
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}

              {certError && (
                <p className="text-xs mt-1" style={{ color: DANGER }}>{certError}</p>
              )}
            </div>
          )}

          {errors.signature && (
            <p className="text-xs" style={{ color: DANGER }}>{errors.signature}</p>
          )}

          {serverError && (
            <div className="p-3 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>
              {serverError}
            </div>
          )}

          {/* Submit: turns green on success, reverts after 5 seconds */}
          <button
            type="submit"
            disabled={loading || success}
            className="cok-btn-primary disabled:cursor-not-allowed"
            style={{
              transition: 'background-color 0.6s ease, transform 0.3s ease',
              ...(success ? { backgroundColor: SUCCESS, opacity: 1 } : {}),
              ...(loading ? { opacity: 0.6 } : {}),
            }}
          >
            {loading
              ? 'Submitting...'
              : success
                ? 'Attendance Recorded'
                : 'Submit Attendance'}
          </button>
        </form>
      </div>
    </div>
  );
}
