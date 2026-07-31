import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import SpiralLoader from '../../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';

const inputClass =
  'w-full px-4 py-3 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

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
      <div className="relative border border-gray-300 bg-white">
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
          <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none select-none">
            Sign here
          </span>
        )}
      </div>
      {hasInk && (
        <button
          type="button"
          onClick={clear}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}

export default function AttendanceForm() {
  const [searchParams] = useSearchParams();

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
        console.log(err)
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

  const [formData, setFormData] = useState({
    attendeeFullName: '',
    attendeeEmail: '',
    attendeePhoneNumber: '',
    attendeeInstitution: isInternal ? 'City of Kigali' : '',
    attendeePosition: '',
  });

  const [signature, setSignature] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!formData.attendeeFullName.trim())
      newErrors.attendeeFullName = 'Full name is required';

    if (formData.attendeeEmail.trim()) {
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

    setLoading(true);
    setServerError('');

    try {
      await axios.post(`${BASE_URL}/attendance`, {
        attendeeFullName: formData.attendeeFullName.trim(),
        attendeeEmail: formData.attendeeEmail.trim() || undefined,
        attendeePhoneNumber: formData.attendeePhoneNumber.trim(),
        attendeeInstitution: isInternal ? 'City of Kigali' : formData.attendeeInstitution.trim(),
        attendeePosition: formData.attendeePosition.trim(),
        eventSpecialId,
        attendeeSignature: signature || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Failed to submit attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while fetching room data
  if (fetchingData) {
    return (
      <div className="  w-full flex items-center justify-center px-4">
        <div className="bg-white border flex flex-row gap-11 items-center border-gray-200 p-8 max-w-sm w-full text-center">
          <SpiralLoader />
          Searching Event Information...
        </div>
      </div>
    );
  }

  // Show fetch error if room-based lookup failed
  if (fetchError) {
    return (
      <div className=" w-full  flex items-center justify-center px-4">
        <div className="bg-white border  border-amber-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">No Live Event Found</h2>
          <p className="text-sm text-gray-500">{fetchError}</p>
        </div>
      </div>
    );
  }

  if ((!eventSpecialId && !isRoomOnly)) {
    return (
      <div className=" w-full flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-100 flex items-center  rounded-full justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Invalid Link</h2>
          <p className="text-sm text-gray-500">This attendance link is missing required event information. Please scan the QR code again.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="w-full  flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Attendance Recorded!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your attendance for <span className="font-semibold text-gray-700">{eventName}</span> has been successfully submitted.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-3 text-left text-xs text-gray-600 space-y-1">
            <p><span className="font-medium">Name:</span> {formData.attendeeFullName}</p>
            <p><span className="font-medium">Event:</span> {eventName}</p>
            <p><span className="font-medium">Room:</span> {eventRoom}</p>
          </div>
          <p className="text-xs text-gray-400">You may now close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[500px] min-w-[300px] flex flex-col items-center justify-start">
      <div className="w-full">

        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 text-white mb-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-wide font-medium">Attendance Registration</p>
              <h1 className="text-base font-bold leading-tight">{eventName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-blue-100">
            {eventRoom && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {eventRoom}
              </span>
            )}
            {roomLocation && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {roomLocation}
              </span>
            )}
            {eventType && (
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5">
                {eventType} Meeting
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 border-t-0 p-6 space-y-5">

          {serverError && (
            <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
              </svg>
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="attendeeFullName" className={labelClass}>
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="attendeeFullName"
              name="attendeeFullName"
              value={formData.attendeeFullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              autoComplete="name"
              className={`${inputClass} ${errors.attendeeFullName ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.attendeeFullName && (
              <p className="text-xs text-red-500">{errors.attendeeFullName}</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label htmlFor="attendeePhoneNumber" className={labelClass}>
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="attendeePhoneNumber"
              name="attendeePhoneNumber"
              value={formData.attendeePhoneNumber}
              onChange={handleChange}
              placeholder="e.g. +250 7XX XXX XXX"
              autoComplete="tel"
              className={`${inputClass} ${errors.attendeePhoneNumber ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.attendeePhoneNumber && (
              <p className="text-xs text-red-500">{errors.attendeePhoneNumber}</p>
            )}
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <label htmlFor="attendeePosition" className={labelClass}>
              Position / Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="attendeePosition"
              name="attendeePosition"
              value={formData.attendeePosition}
              onChange={handleChange}
              placeholder="e.g. Software Engineer, Director"
              autoComplete="organization-title"
              className={`${inputClass} ${errors.attendeePosition ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.attendeePosition && (
              <p className="text-xs text-red-500">{errors.attendeePosition}</p>
            )}
          </div>

          {/* Institution — hidden for internal meetings */}
          {!isInternal && (
            <div className="space-y-1.5">
              <label htmlFor="attendeeInstitution" className={labelClass}>
                Institution / Organization <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="attendeeInstitution"
                name="attendeeInstitution"
                value={formData.attendeeInstitution}
                onChange={handleChange}
                placeholder="e.g. Rwanda Development Board"
                autoComplete="organization"
                className={`${inputClass} ${errors.attendeeInstitution ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.attendeeInstitution && (
                <p className="text-xs text-red-500">{errors.attendeeInstitution}</p>
              )}
            </div>
          )}

          {/* Email — optional */}
          <div className="space-y-1.5">
            <label htmlFor="attendeeEmail" className={labelClass}>
              Email Address
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              id="attendeeEmail"
              name="attendeeEmail"
              value={formData.attendeeEmail}
              onChange={handleChange}
              placeholder="your.email@example.com"
              autoComplete="email"
              className={`${inputClass} ${errors.attendeeEmail ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {errors.attendeeEmail && (
              <p className="text-xs text-red-500">{errors.attendeeEmail}</p>
            )}
          </div>

          {/* Digital Signature — optional, drawn while submitting attendance */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              Digital Signature
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional — draw with your finger or mouse)</span>
            </label>
            <SignaturePad onChange={setSignature} />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submit Attendance
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Fields marked with <span className="text-red-500">*</span> are required
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          City of Kigali Event Management System
        </p>
      </div>
    </div>
  );
}
