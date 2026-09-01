import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { FiUser } from 'react-icons/fi';
import ActivityAgenda from './ActivityAgenda';
import { employeeService } from '../../../../core/services/employeeService';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const SUCCESS = '#4CAF50';
const DANGER = '#E74C3C';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const parseTimeToMinutes = (t) => {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3] ? m[3].toUpperCase() : null;
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

const toHHMM = (d) => {
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};

const formatSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function EventAgendaSection({ event, isLive = false, canEdit = false, eventType = 'live', onUpdated }) {
  const agenda = event?.activityAgenda || [];
  const [now, setNow] = useState(() => new Date());
  const [showFull, setShowFull] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showPresenterPicker, setShowPresenterPicker] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [copiedVirtualLink, setCopiedVirtualLink] = useState(false);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    if (showPresenterPicker === null) return;
    if (!employeeSearch.trim()) { setEmployees([]); return }
    const timer = setTimeout(async () => {
      setSearchingEmployees(true);
      try {
        const res = await employeeService.search(employeeSearch.trim(), 1, 20);
        setEmployees(res?.data || []);
      } catch {
        setEmployees([]);
      } finally {
        setSearchingEmployees(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [employeeSearch, showPresenterPicker]);

  const copyVirtualLink = () => {
    if (event?.virtualLink) {
      navigator.clipboard.writeText(event.virtualLink).then(() => {
        setCopiedVirtualLink(true);
        setTimeout(() => setCopiedVirtualLink(false), 2000);
      });
    }
  };

  const pickPresenter = (emp, agendaIndex) => {
    const updatedDraft = [...draft];
    updatedDraft[agendaIndex] = {
      ...updatedDraft[agendaIndex],
      presenter: {
        name: emp.full_name || '',
        email: emp.email || '',
        role: emp.title || '',
      },
    };
    setDraft(updatedDraft);
    setShowPresenterPicker(null);
    setEmployeeSearch('');
  };

  const removePresenter = (agendaIndex) => {
    const updatedDraft = [...draft];
    updatedDraft[agendaIndex] = { ...updatedDraft[agendaIndex], presenter: null };
    setDraft(updatedDraft);
  };

  if (!agenda.length && !(canEdit && isLive)) return null;

  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const timed = agenda.map((item, index) => {
    const from = parseTimeToMinutes(item.fromTime);
    const to = parseTimeToMinutes(item.toTime);
    let status = null;
    if (isLive && from !== null && to !== null) {
      if (nowSeconds >= to * 60) status = 'ended';
      else if (nowSeconds >= from * 60) status = 'live';
      else status = 'upcoming';
    }
    return { ...item, index, from, to, status };
  });

  const liveItem = timed.find((a) => a.status === 'live');
  const nextItem = timed.find((a) => a.status === 'upcoming');
  const timedItems = timed.filter((a) => a.status !== null);
  const allEnded = isLive && timedItems.length > 0 && timedItems.every((a) => a.status === 'ended');

  const secondsUntilMinute = (minute) => Math.max(0, minute * 60 - nowSeconds);

  const eventStartBound = toHHMM(event?.startedAt || event?.willStartAt || event?.startTime);
  const eventEndBound = toHHMM(event?.willEndAt || event?.endTime);
  const overMidnight = !!(eventStartBound && eventEndBound && eventEndBound <= eventStartBound);

  const startEditing = () => {
    setSaveError(null);
    const eventStartTime = toHHMM(event?.startedAt || event?.willStartAt || event?.startTime);
    if (agenda.length) {
      setDraft(agenda.map((a) => ({ ...a })));
    } else {
      const firstItem = { fromTime: eventStartTime || '', toTime: '', title: '', description: '', presenter: null };
      setDraft([firstItem]);
    }
    setEditing(true);
  };

  const validateDraft = (items) => {
    if (items.length === 0) return 'Cannot save empty agenda. Add at least one item.';
    for (let i = 0; i < items.length; i++) {
      if (!items[i].title?.trim()) return `Agenda item ${i + 1} needs a title`;
      if (!items[i].description?.trim()) return `Agenda item ${i + 1} needs a description`;
      const from = parseTimeToMinutes(items[i].fromTime);
      const to = parseTimeToMinutes(items[i].toTime);
      if (from === null || to === null) return `Agenda item ${i + 1} needs valid From and To times`;
      if (to <= from) return `Agenda item ${i + 1}: end time must be after start time`;
      for (let j = 0; j < i; j++) {
        const otherFrom = parseTimeToMinutes(items[j].fromTime);
        const otherTo = parseTimeToMinutes(items[j].toTime);
        if (otherFrom === null || otherTo === null) continue;
        if (from < otherTo && to > otherFrom) {
          return `Agenda item ${i + 1} (${items[i].fromTime} - ${items[i].toTime}) overlaps with item ${j + 1} (${items[j].fromTime} - ${items[j].toTime})`;
        }
      }
    }
    return null;
  };

  const saveAgenda = async () => {
    const items = draft.filter((a) => a.title?.trim() || a.description?.trim());
    if (items.length === 0) {
      setSaveError('Cannot save empty agenda. Add at least one item with title and description.');
      return;
    }
    const collision = validateDraft(items);
    if (collision) {
      setSaveError(collision);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType,
        section: 'agenda',
        data: { activityAgenda: items },
      });
      if (res.data.success) {
        onUpdated?.(res.data.data);
        setEditing(false);
      } else {
        setSaveError(res.data.message || 'Failed to update agenda');
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusChip = (item) => {
    if (item.status === 'live') {
      return (
        <span className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="cok-badge-animated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: PRIMARY }}>
            Current
          </span>
          <span className="text-[11px] font-mono font-bold" style={{ color: PRIMARY }}>
            {formatSeconds(secondsUntilMinute(item.to))} left
          </span>
        </span>
      );
    }
    if (item.status === 'ended') {
      return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ backgroundColor: BORDER, color: GRAY_DISABLED }}>Ended</span>;
    }
    if (item.status === 'upcoming') {
      return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.1)', color: PRIMARY }}>Upcoming</span>;
    }
    return null;
  };

  const fullCurrent = liveItem || nextItem;

  const isVirtual = event?.eventFormat === 'Virtual' || event?.eventFormat === 'virtual';
  const virtualLink = event?.virtualLink;
  const virtualDescription = event?.virtualDescription;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>
          Agenda {agenda.length > 0 ? `(${agenda.length})` : ''}
        </h2>
        <div className="flex items-center gap-2">
          {isLive && agenda.length > 0 && (
            <button type="button" onClick={() => {
                setShowFull(true);
                window.history.pushState(null, "", `/calendar/#agendafull`);
              }}
              className="cok-btn-primary cursor-pointer"
              style={{ width: 'auto', padding: '0.35rem 0.9rem', fontSize: '11px' }}>
              View Full
            </button>
          )}
          {canEdit && isLive && (
            <button type="button" onClick={() => {
                startEditing();
                window.history.pushState(null, "", `/calendar/#agendaedit`);
              }}
              className="cok-btn-outlined cursor-pointer"
              style={{ padding: '0.35rem 0.9rem', fontSize: '11px' }}>
              Edit Agenda
            </button>
          )}
        </div>
      </div>

      {isVirtual && virtualLink && (
        <div className="mb-4 p-3 border border-gray-200" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PRIMARY, fontFamily: fontHeading }}>Virtual Link</p>
            <button
              type="button"
              onClick={copyVirtualLink}
              className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide px-2 py-1 border"
              style={{ color: PRIMARY, borderColor: PRIMARY, fontFamily: fontHeading }}
            >
              {copiedVirtualLink ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <a
            href={virtualLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline break-all"
            style={{ color: PRIMARY, fontFamily: fontHeading }}
          >
            {virtualLink}
          </a>
          {virtualDescription && (
            <p className="text-xs mt-1 text-gray-600">{virtualDescription}</p>
          )}
        </div>
      )}

      {agenda.length === 0 ? (
        <p className="p-4 text-xs text-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}`, color: GRAY_DISABLED, fontFamily: fontHeading }}>
          No agenda items yet.
        </p>
      ) : (
        <div className="space-y-2">
          {timed.map((item) => (
            <button
              key={item.index}
              type="button"
              onClick={() => isLive && setShowFull(true)}
              className={`w-full text-left p-3 transition-all ${isLive ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                backgroundColor: item.status === 'live' ? 'rgba(5,109,170,0.05)' : WHITE,
                border: `1px solid ${item.status === 'live' ? PRIMARY : BORDER}`,
                opacity: item.status === 'ended' ? 0.6 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold break-words" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {item.index + 1}. {item.title || 'Untitled'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    {item.fromTime && item.toTime ? `${item.fromTime} - ${item.toTime}` : 'No time set'}
                  </p>
                  {item.description && (
                    <p className="text-xs mt-1 break-words" style={{ color: NEUTRAL_DARK }}>{item.description}</p>
                  )}
                  {item.presenter && item.presenter.name && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                      <FiUser className="w-3 h-3" />
                      <span className="font-semibold">Presenter:</span> {item.presenter.name}
                      {item.presenter.role && <span className="text-gray-500"> ({item.presenter.role})</span>}
                    </p>
                  )}
                </div>
                {statusChip(item)}
              </div>
            </button>
          ))}
          {allEnded && (
            <p className="p-2 text-xs font-bold text-center uppercase tracking-wide" style={{ backgroundColor: BORDER, color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              Agenda closed
            </p>
          )}
        </div>
      )}

      {showFull && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 2000000000, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-2xl bg-white flex flex-col max-h-[85vh]" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ backgroundColor: PRIMARY }}>
              <h2 className="text-sm font-bold uppercase tracking-widest text-white" style={{ fontFamily: fontHeading }}>Agenda</h2>
              <button type="button" onClick={() => {
                  setShowFull(false);
                  window.history.pushState(null, "", "/calendar");
                }} className="cok-btn-outlined-reverse cursor-pointer" style={{ padding: '0.35rem 0.9rem' }}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[16rem] flex flex-col" style={{ padding: '20px' }}>
              {allEnded ? (
                <div className="flex-1 flex flex-col items-start justify-center gap-4">
                  <p className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Closed</p>
                  <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>All agenda items have ended.</p>
                </div>
              ) : fullCurrent ? (
                <div className="flex flex-col h-full">
                  {/* Top row - Pulsing time on left, Presenter on right */}
                  <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <p className="text-xl sm:text-3xl font-bold font-mono animate-pulse" style={{ color: '#22c55e', fontFamily: fontHeading }}>
                      {fullCurrent.fromTime} - {fullCurrent.toTime}
                    </p>
                    {fullCurrent.presenter && fullCurrent.presenter.name && (
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Presenter</p>
                        <p className="text-sm sm:text-base font-semibold uppercase mt-0.5" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                          {fullCurrent.presenter.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Middle section - Title centered */}
                  <div className="flex-1 flex flex-col items-start justify-center gap-4 sm:gap-6">
                    <p className="text-xl sm:text-3xl font-extrabold break-words" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, overflowWrap: 'anywhere' }}>
                      {fullCurrent.index + 1}. {fullCurrent.title || 'Untitled'}
                    </p>
                  </div>

                  {/* Bottom section - Description left, Time remaining centered */}
                  <div className="mt-4 sm:mt-6 flex flex-col gap-4">
                    {fullCurrent.description && (
                      <p className="text-sm sm:text-base break-words max-w-xl text-left" style={{ color: NEUTRAL_DARK, overflowWrap: 'anywhere' }}>{fullCurrent.description}</p>
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                        {fullCurrent.status === 'live' ? 'Time remaining' : 'Starts in'}
                      </p>
                      <p className="text-2xl sm:text-4xl font-mono font-bold" style={{ color: PRIMARY }}>
                        {fullCurrent.status === 'live'
                          ? formatSeconds(secondsUntilMinute(fullCurrent.to))
                          : formatSeconds(secondsUntilMinute(fullCurrent.from))}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-start justify-start">
                  <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No timed agenda items to display.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {editing && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 2000000000, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-2xl bg-white flex flex-col max-h-[85vh]" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <h2 className="text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Edit Agenda</h2>
              <button type="button" onClick={() => {
                  setEditing(false);
                  window.history.pushState(null, "", "/calendar");
                }} disabled={saving} className="cok-btn-outlined cursor-pointer disabled:opacity-50" style={{ padding: '0.35rem 0.9rem', fontSize: '11px' }}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              <ActivityAgenda
                agenda={draft}
                onChange={setDraft}
                eventStartTime={eventStartBound}
                eventEndTime={eventEndBound}
                overMidnight={overMidnight}
              />
              {saveError && (
                <p className="mt-3 p-2 text-xs" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>{saveError}</p>
              )}
            </div>
            <div className="flex gap-3 px-4 sm:px-6 py-4 shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="cok-btn-outlined flex-1 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={saveAgenda} disabled={saving} className="cok-btn-primary flex-1 disabled:opacity-50" style={{ width: 'auto' }}>
                {saving ? 'Saving...' : 'Save Agenda'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
