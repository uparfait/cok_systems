import { useState } from 'react';
import TimeInput24 from './TimeInput24';

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

const inputClassName = "w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base";

const labelS = {
  fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block',
  color: NEUTRAL_DARK, marginBottom: '8px',
};

const emptyItem = { fromTime: '', toTime: '', title: '', description: '' };

export default function ActivityAgenda({ agenda, onChange, eventStartTime, eventEndTime, overMidnight = false }) {
  const [editingItem, setEditingItem] = useState(null);
  const [savedItems, setSavedItems] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const getSavedTimeRanges = (excludeIndex) => {
    const ranges = [];
    Object.keys(savedItems).forEach((key) => {
      const idx = parseInt(key);
      if (savedItems[key] && idx !== excludeIndex && agenda[idx]) {
        const item = agenda[idx];
        if (item.fromTime && item.toTime) {
          ranges.push({ index: idx, from: item.fromTime, to: item.toTime });
        }
      }
    });
    return ranges;
  };

  const isTimeOverlapping = (fromTime, toTime, excludeIndex) => {
    const savedRanges = getSavedTimeRanges(excludeIndex);
    for (const range of savedRanges) {
      if (fromTime < range.to && toTime > range.from) {
        return { overlapping: true, withItem: range.index + 1 };
      }
    }
    return { overlapping: false, withItem: null };
  };

  const validateItem = (index, item) => {
    const errs = { fromTime: null, toTime: null, title: null, description: null };

    if (!item.fromTime) errs.fromTime = 'From time is required';
    if (!item.toTime) errs.toTime = 'End time is required';
    if (!item.title || !item.title.trim()) errs.title = 'Title is required';
    if (!item.description || !item.description.trim()) errs.description = 'Description is required';

    if (item.fromTime && item.toTime) {
      if (overMidnight && eventStartTime && eventEndTime) {
        const inRange1 = item.fromTime >= eventStartTime && item.fromTime <= '23:59' && item.toTime >= eventStartTime && item.toTime <= '23:59';
        const inRange2 = item.fromTime >= '00:00' && item.fromTime <= eventEndTime && item.toTime >= '00:00' && item.toTime <= eventEndTime;
        const crossMidnight = item.fromTime >= eventStartTime && item.fromTime <= '23:59' && item.toTime >= '00:00' && item.toTime <= eventEndTime;

        if (!inRange1 && !inRange2 && !crossMidnight) {
          errs.fromTime = `Times must be between ${eventStartTime}-23:59 or 00:00-${eventEndTime} next day.`;
        }
      } else if (eventStartTime && eventEndTime) {
        if (item.fromTime < eventStartTime) {
          errs.fromTime = `From time must be at or after ${eventStartTime}`;
        }
        if (item.toTime > eventEndTime) {
          errs.toTime = `To time must be at or before ${eventEndTime}`;
        }
      }

      if (item.toTime <= item.fromTime && (!overMidnight || item.fromTime < item.toTime)) {
        errs.toTime = errs.toTime || 'End time must be after From time';
      }

      const { overlapping, withItem } = isTimeOverlapping(item.fromTime, item.toTime, index);
      if (overlapping) {
        errs.toTime = `Time overlaps with Agenda item ${withItem}`;
      }
    }

    return errs;
  };

  const handleAgendaChange = (index, field, value) => {
    const updated = [...agenda];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);

    const itemErrors = validateItem(index, updated[index]);
    setErrors((prev) => ({ ...prev, [index]: itemErrors }));
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => {
      const next = { ...prev };
      next[index] = { ...next[index], [field]: true };
      return next;
    });
  };

  const addAgendaItem = () => {
    onChange([...agenda, { ...emptyItem }]);
    setEditingItem(agenda.length);
  };

  const removeAgendaItem = (index) => {
    const updated = agenda.filter((_, i) => i !== index);
    onChange(updated);

    const newSaved = { ...savedItems };
    delete newSaved[index];
    const reindexedSaved = {};
    Object.keys(newSaved).forEach((key) => {
      const keyNum = parseInt(key);
      reindexedSaved[keyNum > index ? keyNum - 1 : keyNum] = newSaved[key];
    });
    setSavedItems(reindexedSaved);

    const newErrors = { ...errors };
    delete newErrors[index];
    const reindexedErrors = {};
    Object.keys(newErrors).forEach((key) => {
      const keyNum = parseInt(key);
      reindexedErrors[keyNum > index ? keyNum - 1 : keyNum] = newErrors[key];
    });
    setErrors(reindexedErrors);

    const newTouched = { ...touched };
    delete newTouched[index];
    const reindexTouched = {};
    Object.keys(newTouched).forEach((key) => {
      const keyNum = parseInt(key);
      reindexTouched[keyNum > index ? keyNum - 1 : keyNum] = newTouched[key];
    });
    setTouched(reindexTouched);

    if (editingItem === index) setEditingItem(null);
    else if (editingItem > index) setEditingItem(editingItem - 1);
  };

  const saveItem = (index) => {
    const item = agenda[index];
    const itemErrors = validateItem(index, item);
    setErrors((prev) => ({ ...prev, [index]: itemErrors }));
    setTouched((prev) => {
      const next = { ...prev };
      next[index] = { fromTime: true, toTime: true, title: true, description: true };
      return next;
    });

    if (Object.values(itemErrors).some(Boolean)) return;

    setSavedItems((prev) => ({ ...prev, [index]: true }));
    setEditingItem(null);
  };

  const clearItem = (index) => {
    handleAgendaChange(index, 'fromTime', '');
    handleAgendaChange(index, 'toTime', '');
    handleAgendaChange(index, 'title', '');
    handleAgendaChange(index, 'description', '');
  };

  const startEditing = (index) => {
    setSavedItems((prev) => ({ ...prev, [index]: false }));
    setEditingItem(index);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setTouched((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const isItemSaved = (index) => savedItems[index] === true;

  return (
    <div className="pt-2 flex flex-col gap-4">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Meeting agenda</h2>
      <div className="flex flex-col gap-4">
        {agenda.map((a, i) => (
          <AgendaItem
            key={i}
            index={i}
            item={a}
            isSaved={isItemSaved(i)}
            itemErrors={errors[i] || {}}
            itemTouched={touched[i] || {}}
            onChange={handleAgendaChange}
            onBlurAction={handleBlur}
            onSave={saveItem}
            onClear={clearItem}
            onEdit={startEditing}
            onRemove={removeAgendaItem}
            eventStartTime={eventStartTime}
            eventEndTime={eventEndTime}
            overMidnight={overMidnight}
          />
        ))}
        <button
          type="button"
          onClick={addAgendaItem}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-center pt-1"
          style={{ color: PRIMARY, fontFamily: fontHeading }}
        >
          Add agenda item
        </button>
      </div>
    </div>
  );
}

function AgendaItem({ index, item, isSaved, itemErrors, itemTouched, onChange, onBlurAction, onSave, onClear, onEdit, onRemove, eventStartTime, eventEndTime, overMidnight }) {
  const isComplete = item.fromTime && item.toTime && item.title && item.description;
  const cardBorder = isSaved ? SUCCESS : BORDER;

  const fieldError = (field) => (itemTouched[field] ? itemErrors[field] : null);
  const hasFieldError = (field) => Boolean(fieldError(field));

  return (
    <div
      className="p-4 relative flex flex-col gap-3"
      style={{ backgroundColor: WHITE, border: `1px solid ${cardBorder}`, borderRadius: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Agenda item {index + 1}</span>
          {isSaved && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5" style={{ color: WHITE, backgroundColor: SUCCESS }}>
              Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isSaved && (
            <button type="button" onClick={() => onEdit(index)}
              className="cursor-pointer text-xs font-semibold uppercase tracking-wide px-2 py-1 text-[#056daa] hover:text-[#045a8a] hover:underline"
              style={{ fontFamily: fontHeading }}>
              Edit
            </button>
          )}
          <button type="button" onClick={() => onRemove(index)}
            className="cursor-pointer text-xs font-semibold uppercase tracking-wide px-2 py-1 text-[#9E9E9E] hover:text-[#C0392B] hover:underline"
            style={{ fontFamily: fontHeading }}
            aria-label={`Remove agenda item ${index + 1}`}>
            Remove
          </button>
        </div>
      </div>

      {/* Time Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5" onBlur={() => onBlurAction(index, 'fromTime')}>
          <label style={labelS}>From Time (24-hour)</label>
          <TimeInput24
            disabled={isSaved}
            hasError={hasFieldError('fromTime')}
            value={item.fromTime}
            onChange={(value) => onChange(index, 'fromTime', value)}
          />
          {fieldError('fromTime') && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError('fromTime')}</p>}
        </div>
        <div className="flex flex-col gap-1.5" onBlur={() => onBlurAction(index, 'toTime')}>
          <label style={labelS}>To Time (24-hour)</label>
          <TimeInput24
            disabled={isSaved}
            hasError={hasFieldError('toTime')}
            value={item.toTime}
            onChange={(value) => onChange(index, 'toTime', value)}
          />
          {fieldError('toTime') && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError('toTime')}</p>}
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label style={labelS}>Title</label>
        <input
          type="text"
          disabled={isSaved}
          required
          placeholder="e.g. Introduction"
          className={inputClassName}
          style={{ borderColor: hasFieldError('title') ? DANGER : undefined }}
          value={item.title}
          onBlur={() => onBlurAction(index, 'title')}
          onChange={(e) => onChange(index, 'title', e.target.value)}
        />
        {fieldError('title') && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError('title')}</p>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label style={labelS}>Description</label>
        <textarea
          disabled={isSaved}
          required
          rows={2}
          placeholder="Provide specific agenda item context details..."
          className={inputClassName}
          style={{ resize: 'vertical', minHeight: '60px', borderColor: hasFieldError('description') ? DANGER : undefined }}
          value={item.description}
          onBlur={() => onBlurAction(index, 'description')}
          onChange={(e) => onChange(index, 'description', e.target.value)}
        />
        {fieldError('description') && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError('description')}</p>}
      </div>

      {/* Action Buttons */}
      {!isSaved && (
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={() => onSave(index)}
            disabled={!isComplete}
            className="cok-btn-primary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: fontHeading }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onClear(index)}
            className="cok-btn-outlined text-xs"
            style={{ fontFamily: fontHeading }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
