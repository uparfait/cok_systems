import { useState, useEffect } from 'react';
import axios from 'axios';
import { FiX, FiUsers, FiLoader } from 'react-icons/fi';
import { COK, CokBadge, CokTh, CokTableEmpty } from '../mayorCok';

// Field label in CoK primary blue (per design rule: Montserrat, uppercase, letter-spaced)
const BlueLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="uppercase"
    style={{
      fontFamily: COK.headingFont,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.6px',
      color: COK.primary,
      margin: 0,
    }}
  >
    {children}
  </p>
);

// Blue field name above a bordered white box holding the value in body-text black
const FieldCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="mb-1">
      <BlueLabel>{label}</BlueLabel>
    </div>
    <div className="bg-white px-2.5 py-1.5" style={{ border: `1px solid ${COK.border}` }}>
      <p className="text-[13px] leading-snug" style={{ fontFamily: COK.bodyFont, color: COK.neutralDark, margin: 0 }}>
        {value}
      </p>
    </div>
  </div>
);

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
  createdAt?: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  live: { label: 'Happening Now', color: COK.success },
  upcoming: { label: 'Upcoming', color: COK.primary },
  recurring: { label: 'Recurring', color: COK.warning },
  past: { label: 'Completed', color: '#9E9E9E' },
};

function eventAccent(ev: MayorCalendarEvent): string {
  return ev.eventMeetingType === 'meet' ? COK.primary : COK.success;
}

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

  // Badge chips styled exactly like the event manager's events table
  const meetingTypeBadge = event.eventMeetingType === 'meet'
    ? <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">Meeting</span>
    : <span className="inline-block bg-blue-50 text-sky-700 border border-blue-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">Event</span>;

  const modeBadge = (() => {
    switch (event.eventType) {
      case 'Special':
      case 'External':
        return <span className="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold">{event.eventType}</span>;
      case 'Joint':
        return <span className="inline-block bg-teal-50 text-teal-800 border border-teal-300 px-2.5 py-0.5 text-xs font-semibold">{event.eventType}</span>;
      default:
        return event.eventType
          ? <span className="inline-block bg-indigo-50 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 text-xs font-semibold">{event.eventType}</span>
          : <span className="text-gray-400">N/A</span>;
    }
  })();

  const statusBadge = (() => {
    const cls = 'inline-block px-3 py-1 text-xs font-bold uppercase tracking-wide border';
    if (event.isCancelled) return <span className={`${cls} bg-red-50 text-red-700 border-red-300`}>Cancelled</span>;
    if (liveNow) return <span className={`${cls} bg-emerald-100 text-emerald-800 border-emerald-300`}>Live</span>;
    if (badge.label === 'Upcoming') return <span className={`${cls} bg-sky-100 text-sky-800 border-sky-300`}>Upcoming</span>;
    if (badge.label === 'Recurring') return <span className={`${cls} bg-violet-100 text-violet-800 border-violet-300`}>Recurring</span>;
    if (badge.label === 'Completed') return <span className={`${cls} bg-gray-100 text-gray-500 border-gray-300`}>Past</span>;
    return <span className={`${cls} bg-gray-100 text-gray-700 border-gray-300`}>{badge.label}</span>;
  })();

  const timeCell = start && end ? (
    <div className="text-sm leading-snug">
      <div className="text-gray-700">
        {new Date(start).toLocaleDateString()}
        {!sameDay && <> - {new Date(end).toLocaleDateString()}</>}
      </div>
      <div className="text-gray-500 text-xs">{formatTimeRange(start, end)}</div>
    </div>
  ) : (
    <span className="text-gray-400 text-sm">N/A</span>
  );

  const organizerCell = organizer?.fullNames ? (
    <div className="text-sm leading-snug">
      <div className="font-semibold text-gray-900">{organizer.fullNames}</div>
      {(organizer.phone || organizer.telephone) && <div className="text-gray-500 text-xs">{organizer.phone || organizer.telephone}</div>}
      {organizer.email && <div className="text-gray-500 text-xs">{organizer.email}</div>}
    </div>
  ) : (
    <span className="text-gray-400">N/A</span>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(51,51,51,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-lg"
        style={{ border: `1px solid ${COK.border}`, borderTop: `3px solid ${COK.primary}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
      >
        {/* Header — the View Attendance action lives here so it is visible without scrolling */}
        <div className="flex items-start justify-between gap-3 p-3 sticky top-0 bg-white z-10" style={{ borderBottom: `1px solid ${COK.border}` }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CokBadge label={badge.label} color={badge.color} />
              <CokBadge label={event.eventMeetingType === 'meet' ? 'Meeting' : 'Event'} color={eventAccent(event)} />
            </div>
            <h3 className="mt-1.5 truncate" style={{ fontFamily: COK.headingFont, fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: COK.primary, margin: '6px 0 0 0' }}>
              {event.eventName}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canViewAttendance && (
              <button
                type="button"
                onClick={() => setShowAttendance((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 text-white text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-90"
                style={{ backgroundColor: COK.primary, fontFamily: COK.headingFont, cursor: 'pointer' }}
              >
                <FiUsers className="w-4 h-4" />
                {showAttendance ? 'Hide Attendance' : 'View Attendance'}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 shrink-0"
              style={{ border: `1px solid ${COK.border}` }}
            >
              <FiX className="w-4 h-4" style={{ color: COK.neutralDark }} />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Core details as a single-row table, styled like the event manager's events table */}
          <div className="overflow-x-auto" style={{ border: `1px solid ${COK.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <CokTh>Type</CokTh>
                  <CokTh>Event/Meet Name</CokTh>
                  <CokTh>Mode</CokTh>
                  <CokTh>Room</CokTh>
                  <CokTh>Expected Audience</CokTh>
                  <CokTh>Organizer</CokTh>
                  <CokTh>Status</CokTh>
                  <CokTh>Time</CokTh>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="px-4 py-4 border-r" style={{ borderColor: COK.neutralLight }}>{meetingTypeBadge}</td>
                  <td className="px-4 py-4 font-bold text-gray-900 border-r" style={{ fontFamily: COK.headingFont, borderColor: COK.neutralLight }}>{event.eventName || '—'}</td>
                  <td className="px-4 py-4 border-r" style={{ borderColor: COK.neutralLight }}>{modeBadge}</td>
                  <td className="px-4 py-4 text-gray-700 border-r" style={{ fontFamily: COK.bodyFont, borderColor: COK.neutralLight }}>{event.eventRoom || '—'}</td>
                  <td className="px-4 py-4 text-gray-900 border-r" style={{ borderColor: COK.neutralLight }}>{event.expectedAudience ?? '—'}</td>
                  <td className="px-4 py-4 border-r" style={{ borderColor: COK.neutralLight }}>{organizerCell}</td>
                  <td className="px-4 py-4 border-r" style={{ borderColor: COK.neutralLight }}>{statusBadge}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{timeCell}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {event.eventDescription && (
            <FieldCell label="Description" value={event.eventDescription} />
          )}

          {/* Attendance report, revealed on demand (past and live events only) */}
          {canViewAttendance && showAttendance && (
            <div className="bg-white" style={{ border: `1px solid ${COK.border}` }}>
              <div className="flex items-center justify-between p-3" style={{ borderBottom: `1px solid ${COK.border}`, backgroundColor: COK.neutralLight }}>
                <div className="flex items-center gap-2">
                  <FiUsers className="w-4 h-4" style={{ color: COK.primary }} />
                  <BlueLabel>Signed Attendance Report</BlueLabel>
                </div>
                <span style={{ fontFamily: COK.headingFont, fontSize: 16, fontWeight: 700, color: COK.primary }}>
                  {attendanceLoading ? '…' : attendees.length}
                  <span className="ml-1 text-xs font-medium" style={{ color: '#888888' }}>
                    attendee{attendees.length === 1 ? '' : 's'}
                  </span>
                </span>
              </div>

              {attendanceLoading && (
                <div className="flex items-center justify-center py-10">
                  <FiLoader className="w-5 h-5 animate-spin" style={{ color: COK.primary }} />
                  <span className="ml-2 text-sm" style={{ fontFamily: COK.headingFont, color: '#888888' }}>Loading attendance…</span>
                </div>
              )}

              {!attendanceLoading && attendanceError && (
                <div className="m-3 p-3 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: COK.headingFont }}>
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
                          <td className="px-4 py-3 font-medium" style={{ fontFamily: COK.headingFont, color: COK.neutralDark }}>{a.attendeeFullName}</td>
                          <td className="px-4 py-3" style={{ fontFamily: COK.bodyFont, color: '#555555' }}>{a.attendeeInstitution || '—'}</td>
                          <td className="px-4 py-3" style={{ fontFamily: COK.bodyFont, color: '#555555' }}>{a.attendeePosition || '—'}</td>
                          <td className="px-4 py-3">
                            {a.attendeeSignature ? (
                              <img src={a.attendeeSignature} alt={`Signature of ${a.attendeeFullName}`} className="h-8 max-w-[110px] object-contain" />
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

        <div className="px-3 py-1.5 text-[11px] text-gray-400" style={{ borderTop: `1px solid ${COK.border}`, fontFamily: COK.bodyFont }}>
          Event information managed by the Event Manager's office.
        </div>
      </div>
    </div>
  );
}
