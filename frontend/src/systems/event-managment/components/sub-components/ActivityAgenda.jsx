import { useState } from 'react';
import { FiPlus, FiTrash2, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

const inputBase = {
  fontFamily: fontHeading, fontSize: '14px', fontWeight: 500, letterSpacing: '0.2px',
  lineHeight: '1.4', width: '100%', padding: '12px 1rem', boxSizing: 'border-box',
  border: `1px solid ${BORDER}`, borderRadius: 0, outline: 'none',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const focusHandlers = (hasError) => ({
  onFocus: (e) => {
    e.currentTarget.style.borderColor = hasError ? DANGER : PRIMARY;
    e.currentTarget.style.boxShadow = hasError
      ? '0px 4px 8px rgba(231,76,60,0.25)'
      : '0px 4px 8px rgba(7,142,206,0.25)';
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = hasError ? DANGER : BORDER;
    e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
  },
});

export default function ActivityAgenda({ agenda, onChange, eventStartTime, eventEndTime, overMidnight = false }) {
  const [editingPhase, setEditingPhase] = useState(null);
  const [savedPhases, setSavedPhases] = useState({});
  const [errors, setErrors] = useState({});

  const getSavedTimeRanges = (excludeIndex) => {
    const ranges = [];
    Object.keys(savedPhases).forEach((key) => {
      const idx = parseInt(key);
      if (savedPhases[key] && idx !== excludeIndex && agenda[idx]) {
        const phase = agenda[idx];
        if (phase.fromTime && phase.toTime) {
          ranges.push({ index: idx, from: phase.fromTime, to: phase.toTime });
        }
      }
    });
    return ranges;
  };

  const isTimeOverlapping = (fromTime, toTime, excludeIndex) => {
    const savedRanges = getSavedTimeRanges(excludeIndex);
    for (const range of savedRanges) {
      if (fromTime < range.to && toTime > range.from) {
        return { overlapping: true, withPhase: range.index + 1 };
      }
    }
    return { overlapping: false, withPhase: null };
  };

  const validatePhase = (index, phase) => {
    const phaseErrors = [];

    if (!phase.fromTime) {
      phaseErrors.push('From time is required');
    }
    if (!phase.toTime) {
      phaseErrors.push('To time is required');
    }
    if (!phase.title || !phase.title.trim()) {
      phaseErrors.push('Title is required');
    }
    if (!phase.description || !phase.description.trim()) {
      phaseErrors.push('Description is required');
    }

    if (phase.fromTime && phase.toTime) {
      if (overMidnight && eventStartTime && eventEndTime) {
        const inRange1 = phase.fromTime >= eventStartTime && phase.fromTime <= '23:59' && phase.toTime >= eventStartTime && phase.toTime <= '23:59';
        const inRange2 = phase.fromTime >= '00:00' && phase.fromTime <= eventEndTime && phase.toTime >= '00:00' && phase.toTime <= eventEndTime;
        const crossMidnight = phase.fromTime >= eventStartTime && phase.fromTime <= '23:59' && phase.toTime >= '00:00' && phase.toTime <= eventEndTime;

        if (!inRange1 && !inRange2 && !crossMidnight) {
          phaseErrors.push(`Times must be between ${eventStartTime}-23:59 or 00:00-${eventEndTime} next day.`);
        }
      } else {
        if (eventStartTime && eventEndTime) {
          if (phase.fromTime < eventStartTime) {
            phaseErrors.push(`From time must be at or after ${eventStartTime}`);
          }
          if (phase.toTime > eventEndTime) {
            phaseErrors.push(`To time must be at or before ${eventEndTime}`);
          }
        }
      }

      if (phase.fromTime >= phase.toTime) {
        if (!overMidnight || phase.fromTime < phase.toTime) {
          phaseErrors.push('To time must be after From time');
        }
      }

      const { overlapping, withPhase } = isTimeOverlapping(phase.fromTime, phase.toTime, index);
      if (overlapping) {
        phaseErrors.push(`Time overlaps with Phase ${withPhase}`);
      }
    }

    return phaseErrors;
  };

  const handleAgendaChange = (index, field, value) => {
    const updated = [...agenda];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);

    if (errors[index]) {
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const addAgendaItem = () => {
    onChange([...agenda, { fromTime: '', toTime: '', title: '', description: '' }]);
    setEditingPhase(agenda.length);
  };

  const removeAgendaItem = (index) => {
    const updated = agenda.filter((_, i) => i !== index);
    onChange(updated);

    const newSaved = { ...savedPhases };
    delete newSaved[index];
    const reindexed = {};
    Object.keys(newSaved).forEach((key) => {
      const keyNum = parseInt(key);
      reindexed[keyNum > index ? keyNum - 1 : keyNum] = newSaved[key];
    });
    setSavedPhases(reindexed);

    const newErrors = { ...errors };
    delete newErrors[index];
    const reindexedErrors = {};
    Object.keys(newErrors).forEach((key) => {
      const keyNum = parseInt(key);
      reindexedErrors[keyNum > index ? keyNum - 1 : keyNum] = newErrors[key];
    });
    setErrors(reindexedErrors);

    if (editingPhase === index) setEditingPhase(null);
    else if (editingPhase > index) setEditingPhase(editingPhase - 1);
  };

  const savePhase = (index) => {
    const phase = agenda[index];
    const phaseErrors = validatePhase(index, phase);

    if (phaseErrors.length > 0) {
      setErrors(prev => ({ ...prev, [index]: phaseErrors }));
      return;
    }

    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);

    setSavedPhases(prev => ({ ...prev, [index]: true }));
    setEditingPhase(null);
  };

  const clearPhase = (index) => {
    handleAgendaChange(index, 'fromTime', '');
    handleAgendaChange(index, 'toTime', '');
    handleAgendaChange(index, 'title', '');
    handleAgendaChange(index, 'description', '');

    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const startEditing = (index) => {
    setSavedPhases(prev => ({ ...prev, [index]: false }));
    setEditingPhase(index);
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const isPhaseSaved = (index) => savedPhases[index] === true;
  const hasErrors = (index) => errors[index] && errors[index].length > 0;

  return (
    <div className="pt-2 flex flex-col gap-4">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Activity Agenda</h2>
      <div className="flex flex-col gap-4">
        {agenda.map((a, i) => (
          <AgendaItem
            key={i}
            index={i}
            item={a}
            isSaved={isPhaseSaved(i)}
            errors={errors[i] || []}
            hasErrors={hasErrors(i)}
            canRemove={true}
            onChange={handleAgendaChange}
            onSave={savePhase}
            onClear={clearPhase}
            onEdit={startEditing}
            onRemove={removeAgendaItem}
          />
        ))}
        <button
          type="button"
          onClick={addAgendaItem}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors pt-1"
          style={{ color: PRIMARY, fontFamily: fontHeading }}
          onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_HOVER}
          onMouseLeave={(e) => e.currentTarget.style.color = PRIMARY}
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Add New Phase</span>
        </button>
      </div>
    </div>
  );
}

function AgendaItem({ index, item, isSaved, errors, hasErrors, canRemove, onChange, onSave, onClear, onEdit, onRemove }) {
  const isComplete = item.fromTime && item.toTime && item.title && item.description;

  const cardBg = hasErrors ? '#FFEBEE' : isSaved ? '#E8F5E9' : NEUTRAL_LIGHT;
  const cardBorder = hasErrors ? DANGER : isSaved ? SUCCESS : BORDER;

  const labelS = {
    fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block',
    color: TERTIARY, marginBottom: '8px',
  };

  const getInputStyle = (hasError) => ({
    ...inputBase,
    color: NEUTRAL_DARK,
    backgroundColor: isSaved ? '#F2F2F2' : NEUTRAL_LIGHT,
    borderColor: hasError ? DANGER : BORDER,
  });

  return (
    <div
      className="p-4 relative flex flex-col gap-3 transition-all duration-200"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Phase {index + 1}</span>
          {isSaved && !hasErrors && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5" style={{ color: WHITE, backgroundColor: SUCCESS }}>
              Saved
            </span>
          )}
          {hasErrors && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5" style={{ color: WHITE, backgroundColor: DANGER }}>
              Has Errors
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isSaved && !hasErrors && (
            <button type="button" onClick={() => onEdit(index)}
              className="text-xs font-semibold uppercase tracking-wide px-2 py-1 transition-colors"
              style={{ color: PRIMARY, fontFamily: fontHeading }}
              onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_HOVER}
              onMouseLeave={(e) => e.currentTarget.style.color = PRIMARY}>
              Edit
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={() => onRemove(index)}
              className="p-1.5 transition-colors"
              style={{ color: GRAY_DISABLED }}
              onMouseEnter={(e) => e.currentTarget.style.color = DANGER}
              onMouseLeave={(e) => e.currentTarget.style.color = GRAY_DISABLED}
              aria-label="Remove phase">
              <FiTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {hasErrors && (
        <div className="flex flex-col gap-1 p-2" style={{ backgroundColor: 'rgba(231,76,60,0.08)', border: `1px solid ${DANGER}` }}>
          {errors.map((error, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: '#C62828', fontFamily: fontHeading }}>
              <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label style={labelS}>From Time</label>
          <input
            type="time"
            disabled={isSaved}
            required
            style={{ ...getInputStyle(hasErrors), ...focusHandlers(hasErrors) }}
            value={item.fromTime}
            onChange={(e) => onChange(index, 'fromTime', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={labelS}>To Time</label>
          <input
            type="time"
            disabled={isSaved}
            required
            style={{ ...getInputStyle(hasErrors), ...focusHandlers(hasErrors) }}
            value={item.toTime}
            onChange={(e) => onChange(index, 'toTime', e.target.value)}
          />
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
          style={{ ...getInputStyle(hasErrors), ...focusHandlers(hasErrors) }}
          value={item.title}
          onChange={(e) => onChange(index, 'title', e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label style={labelS}>Description</label>
        <textarea
          disabled={isSaved}
          required
          rows={2}
          placeholder="Provide specific agenda item context details..."
          style={{ ...getInputStyle(hasErrors), ...focusHandlers(hasErrors), resize: 'vertical', minHeight: '60px' }}
          value={item.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
        />
      </div>

      {/* Action Buttons */}
      {!isSaved && (
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={() => onSave(index)}
            disabled={!isComplete}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: PRIMARY, fontFamily: fontHeading, border: '0', borderRadius: 0 }}
            onMouseEnter={(e) => { if (isComplete) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = PRIMARY}
          >
            <FiCheck className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={() => onClear(index)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-4 py-2.5 transition-colors"
            style={{ color: NEUTRAL_DARK, backgroundColor: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 0, fontFamily: fontHeading }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = NEUTRAL_DARK}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDER}
          >
            <FiX className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
