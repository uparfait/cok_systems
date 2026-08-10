import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FiX,
  FiUsers,
  FiLoader,
  FiClock,
  FiMapPin,
  FiTag,
  FiLayers,
  FiActivity,
  FiUser,
  FiFileText,
  FiMail,
  FiPhone,
  FiBriefcase,
} from 'react-icons/fi';
import { COK, CokTh, CokTableEmpty } from '../mayorCok';

// Employee-account design constants (same values as EmployeeDashboard / DepartmentQueueTab)
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const fontHeading = COK.headingFont;

const ATTENDANCE_URL = '/cok/api/v1/attendance';

export interface MayorCalendarEvent {
  _id?: string;
  eventSpecialId?: string;
  eventName?: string;
  eventDescription?: string;
  eventMeetingType?: string;
  eventType?: string;
  eventStatus?: string;
  eventRoom?: string;
  eventOrganizer?: { fullNames?: string; email?: string; phone?: string; telephone?: string; institution?: string };
  expectedAudience?: number | string;
  startTime?: string;
  endTime?: string;
  isCancelled?: boolean;
  occurrenceDate?: string;
}

interface AttendanceRecord {
  _id: string;
  attendeeFullName?: string;
  attendeeEmail?: string;
  attendeeInstitution?: string;
  attendeePosition?: string;
  attendeeSignature?: string;
  digitalCertificate?: string;
  createdAt?: string;
}

// Drawn signatures live in attendeeSignature (base64); uploaded ones are stored
// in digitalCertificate as a served file URL — display whichever exists
function signatureImageSrc(a: AttendanceRecord): string | null {
  if (a.attendeeSignature) return a.attendeeSignature;
  if (a.digitalCertificate && /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(a.digitalCertificate)) return a.digitalCertificate;
  return null;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  live: { label: 'Happening Now', color: COK.success },
  upcoming: { label: 'Upcoming', color: COK.primary },
  recurring: { label: 'Recurring', color: COK.warning },
  past: { label: 'Completed', color: '#9E9E9E' },
};

function formatTimeRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const fmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${new Date(startIso).toLocaleTimeString([], fmt)} - ${new Date(endIso).toLocaleTimeString([], fmt)}`;
}

function formatSubmittedAt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Detail card following the CoK design rules: white square card with soft shadow,
// gray uppercase label, bold neutral-dark value, and a uniform primary-blue icon
// in a tinted square at the top-right — no per-card accent colors
function DetailCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="p-4" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW, borderRadius: 0 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: '#555555', margin: '0 0 4px 0' }}>
            {label}
          </p>
          <div className="text-[15px] font-bold leading-snug" style={{ fontFamily: fontHeading, color: COK.neutralDark }}>
            {value}
          </div>
        </div>
        <div className="p-2 shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderRadius: 0 }}>
          <Icon className="w-4 h-4" style={{ color: COK.primary }} />
        </div>
      </div>
    </div>
  );
}

export default function MayorEventDetailsOverlay({
  event,
  window: mergedWindow,
  onClose,
}: {
  event: MayorCalendarEvent;
  window: { start?: string; end?: string };
  onClose: () => void;
}) {
  // The calendar API splits multi-day events into one slice per day; use the merged window
  const start = mergedWindow.start || event.startTime;
  const end = mergedWindow.end || event.endTime;
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  const liveNow = !event.isCancelled && !isNaN(startMs) && !isNaN(endMs) && startMs <= now && now <= endMs;

  const badge = event.isCancelled
    ? { label: 'Cancelled', color: COK.danger }
    : liveNow
      ? STATUS_BADGES.live
      : event.eventStatus === 'recurring'
        ? STATUS_BADGES.recurring
        : !isNaN(startMs) && now < startMs
          ? STATUS_BADGES.upcoming
          : !isNaN(endMs) && now > endMs
            ? STATUS_BADGES.past
            : STATUS_BADGES[event.eventStatus || ''] || { label: 'Scheduled', color: COK.primary };

  // Attendance can be viewed once the event has started
  const canViewAttendance =
    !event.isCancelled && event.eventStatus !== 'recurring' && !!event.eventSpecialId && !isNaN(startMs) && startMs <= now;

  const [showAttendance, setShowAttendance] = useState(false);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceFetched, setAttendanceFetched] = useState(false);

  useEffect(() => {
    if (!showAttendance || attendanceFetched || !event.eventSpecialId) return;
    let ignore = false;
    setAttendanceLoading(true);
    setAttendanceError('');
    axios
      .get(ATTENDANCE_URL, { params: { eventSpecialId: event.eventSpecialId, limit: 500, _t: Date.now() } })
      .then((res) => { if (!ignore) { setAttendees(res.data?.data || []); setAttendanceFetched(true); } })
      .catch(() => { if (!ignore) setAttendanceError('Failed to load the attendance report.'); })
      .finally(() => { if (!ignore) setAttendanceLoading(false); });
    return () => { ignore = true; };
  }, [showAttendance, attendanceFetched, event.eventSpecialId]);

  const sameDay = !!(start && end && new Date(start).toDateString() === new Date(end).toDateString());
  const organizer = event.eventOrganizer;
  const organizerInitials = (organizer?.fullNames || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timeValue = start && end ? (
    <>
      <div>
        {new Date(start).toLocaleDateString()}
        {!sameDay && <> — {new Date(end).toLocaleDateString()}</>}
      </div>
      <div className="text-[12px] font-medium mt-0.5" style={{ color: '#555555' }}>{formatTimeRange(start, end)}</div>
    </>
  ) : 'N/A';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(51,51,51,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: COK.neutralLight, boxShadow: CARD_SHADOW, borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
      >
        {/* Header — solid CoK-blue bar with the meeting/event name, status chips, and actions */}
        <div
          className="flex items-start justify-between gap-3 p-5 sticky top-0 z-10"
          style={{ backgroundColor: COK.primary }}
        >
          <div className="min-w-0">
            <h3
              className="truncate"
              style={{ fontFamily: fontHeading, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: '#FFFFFF', margin: 0 }}
            >
              {event.eventName || 'Untitled Event'}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {[
                badge.label,
                event.eventMeetingType === 'meet' ? 'Meeting' : 'Event',
                ...(event.eventType ? [event.eventType] : []),
              ].map((label) => (
                <span
                  key={label}
                  className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ fontFamily: fontHeading, backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canViewAttendance && (
              <button
                type="button"
                onClick={() => setShowAttendance((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold uppercase transition-colors hover:bg-[rgba(255,255,255,0.12)]"
                style={{ backgroundColor: 'transparent', border: '1px solid #FFFFFF', fontFamily: fontHeading, letterSpacing: '1px', borderRadius: 0, cursor: 'pointer' }}
              >
                <FiUsers className="w-4 h-4" />
                {showAttendance ? 'Hide Attendance' : 'View Attendance'}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center shrink-0 transition-colors hover:bg-[rgba(255,255,255,0.12)]"
              style={{ border: '1px solid #FFFFFF', borderRadius: 0 }}
            >
              <FiX className="w-4 h-4" style={{ color: '#FFFFFF' }} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Detail cards — uniform CoK styling, primary icons only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailCard label="Type" value={event.eventMeetingType === 'meet' ? 'Meeting' : 'Event'} icon={FiTag} />
            <DetailCard label="Mode" value={event.eventType || 'N/A'} icon={FiLayers} />
            <DetailCard label="Status" value={badge.label} icon={FiActivity} />
            <DetailCard label="Room" value={event.eventRoom || 'N/A'} icon={FiMapPin} />
            <DetailCard label="Expected Audience" value={event.expectedAudience ?? 'N/A'} icon={FiUsers} />
            <DetailCard label="Date & Time" value={timeValue} icon={FiClock} />
          </div>

          {/* Organizer — white card with avatar circle, like the employee visitor rows */}
          <div className="bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
            {/* Section header in the receptionist style: round tinted icon chip + small semibold title */}
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderRadius: 999 }}>
                <FiUser className="w-4 h-4" style={{ color: COK.primary }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: COK.neutralDark, margin: 0 }}>
                Organizer
              </h3>
            </div>
            {organizer?.fullNames ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: 'rgba(5,109,170,0.1)', color: COK.primary, fontFamily: fontHeading }}
                >
                  {organizerInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold" style={{ fontFamily: fontHeading, color: COK.neutralDark }}>
                    {organizer.fullNames}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap mt-1">
                    {(organizer.phone || organizer.telephone) && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#555555' }}>
                        <FiPhone className="w-3 h-3" style={{ color: COK.primary }} />
                        {organizer.phone || organizer.telephone}
                      </span>
                    )}
                    {organizer.email && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#555555' }}>
                        <FiMail className="w-3 h-3" style={{ color: COK.primary }} />
                        {organizer.email}
                      </span>
                    )}
                    {organizer.institution && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#555555' }}>
                        <FiBriefcase className="w-3 h-3" style={{ color: COK.primary }} />
                        {organizer.institution}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-sm" style={{ color: '#9E9E9E' }}>N/A</span>
            )}
          </div>

          {/* Description card */}
          {event.eventDescription && (
            <div className="bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderRadius: 999 }}>
                  <FiFileText className="w-4 h-4" style={{ color: COK.primary }} />
                </div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: COK.neutralDark, margin: 0 }}>
                  Description
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ fontFamily: COK.bodyFont, color: COK.neutralDark, margin: 0 }}>
                {event.eventDescription}
              </p>
            </div>
          )}

          {/* Attendance report — blue summary header panel like the employee Queue Summary */}
          {canViewAttendance && showAttendance && (
            <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
              <div className="flex items-center justify-between p-4 text-white" style={{ backgroundColor: COK.primary }}>
                <div className="flex items-center gap-2">
                  <FiUsers className="w-4 h-4 opacity-80" />
                  <span className="text-[13px] font-bold uppercase" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>
                    Signed Attendance Report
                  </span>
                </div>
                <div className="bg-[rgba(255,255,255,0.15)] px-3 py-1">
                  <span style={{ fontFamily: fontHeading, fontSize: 16, fontWeight: 700 }}>
                    {attendanceLoading ? '…' : attendees.length}
                  </span>
                  <span className="ml-1 text-xs opacity-80">
                    attendee{attendees.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {attendanceLoading && (
                <div className="flex items-center justify-center py-10">
                  <FiLoader className="w-5 h-5 animate-spin" style={{ color: COK.primary }} />
                  <span className="ml-2 text-sm" style={{ fontFamily: fontHeading, color: '#888888' }}>Loading attendance…</span>
                </div>
              )}

              {!attendanceLoading && attendanceError && (
                <div className="m-4 p-3 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: fontHeading }}>
                  {attendanceError}
                </div>
              )}

              {!attendanceLoading && !attendanceError && attendanceFetched && attendees.length === 0 && (
                <CokTableEmpty message="No attendance records for this event" />
              )}

              {!attendanceLoading && !attendanceError && attendees.length > 0 && (
                <div className="overflow-x-auto overflow-y-auto max-h-[36vh]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <CokTh>S/N</CokTh>
                        <CokTh>Full Name</CokTh>
                        <CokTh>Institution</CokTh>
                        <CokTh>Position</CokTh>
                        <CokTh>Signature</CokTh>
                        <CokTh>Submitted At</CokTh>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((a, i) => (
                        <tr key={a._id} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : COK.neutralLight }}>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888888' }}>{i + 1}</td>
                          <td className="px-4 py-3 font-medium" style={{ fontFamily: fontHeading, color: COK.neutralDark }}>{a.attendeeFullName}</td>
                          <td className="px-4 py-3" style={{ fontFamily: COK.bodyFont, color: '#555555' }}>{a.attendeeInstitution || '—'}</td>
                          <td className="px-4 py-3" style={{ fontFamily: COK.bodyFont, color: '#555555' }}>{a.attendeePosition || '—'}</td>
                          <td className="px-4 py-3">
                            {signatureImageSrc(a) ? (
                              <img src={signatureImageSrc(a) as string} alt={`Signature of ${a.attendeeFullName}`} className="h-8 max-w-[110px] object-contain" />
                            ) : a.digitalCertificate ? (
                              <a href={a.digitalCertificate} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: COK.primary }}>
                                View file
                              </a>
                            ) : (
                              <span style={{ color: '#CCCCCC' }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#888888' }}>{formatSubmittedAt(a.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-2 text-[11px]" style={{ color: '#9E9E9E', borderTop: `1px solid ${COK.border}`, backgroundColor: '#FFFFFF', fontFamily: COK.bodyFont }}>
          Event information managed by the Event Manager's office.
        </div>
      </div>
    </div>
  );
}
