import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import ActivityAgenda from './ActivityAgenda';

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

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

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
    setDraft(agenda.length ? agenda.map((a) => ({ ...a })) : [{ fromTime: '', toTime: '', title: '', description: '' }]);
    setEditing(true);
  };

  const validateDraft = (items) => {
    for (let i = 0; i < items.length; i++) {
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
    const items = draft.filter((a) => a.title?.trim());
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

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>
          Agenda {agenda.length > 0 ? `(${agenda.length})` : ''}
        </h2>
        <div className="flex items-center gap-2">
          {isLive && agenda.length > 0 && (
            <button type="button" onClick={() => setShowFull(true)}
              className="cok-btn-primary cursor-pointer"
              style={{ width: 'auto', padding: '0.35rem 0.9rem', fontSize: '11px' }}>
              View Full
            </button>
          )}
          {canEdit && isLive && (
            <button type="button" onClick={startEditing}
              className="cok-btn-outlined cursor-pointer"
              style={{ padding: '0.35rem 0.9rem', fontSize: '11px' }}>
              Edit Agenda
            </button>
          )}
        </div>
      </div>

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
              <button type="button" onClick={() => setShowFull(false)} className="cok-btn-outlined-reverse cursor-pointer" style={{ padding: '0.35rem 0.9rem' }}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-center min-h-[16rem] flex flex-col items-center justify-center gap-4">
              {allEnded ? (
                <>
                  <p className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Closed</p>
                  <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>All agenda items have ended.</p>
                </>
              ) : fullCurrent ? (
                <>
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}>
                    {fullCurrent.status === 'live' ? 'Current' : 'Up next'}
                  </span>
                  <p className="text-xl sm:text-3xl font-extrabold break-words w-full" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, overflowWrap: 'anywhere' }}>
                    {fullCurrent.index + 1}. {fullCurrent.title || 'Untitled'}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    {fullCurrent.fromTime} - {fullCurrent.toTime}
                  </p>
                  {fullCurrent.description && (
                    <p className="text-sm sm:text-base break-words max-w-xl w-full" style={{ color: NEUTRAL_DARK, overflowWrap: 'anywhere' }}>{fullCurrent.description}</p>
                  )}
                  <p className="text-3xl sm:text-5xl font-mono font-bold" style={{ color: PRIMARY }}>
                    {fullCurrent.status === 'live'
                      ? formatSeconds(secondsUntilMinute(fullCurrent.to))
                      : formatSeconds(secondsUntilMinute(fullCurrent.from))}
                  </p>
                  <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    {fullCurrent.status === 'live' ? 'Time remaining' : 'Starts in'}
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No timed agenda items to display.</p>
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
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="cok-btn-outlined cursor-pointer disabled:opacity-50" style={{ padding: '0.35rem 0.9rem', fontSize: '11px' }}>
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
