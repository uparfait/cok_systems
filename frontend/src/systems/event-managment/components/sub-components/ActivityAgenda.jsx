import { useState } from 'react';
import { FiPlus, FiTrash2, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const inputClassDisabled = 'w-full px-4 py-2.5 border border-gray-200 ppp-lg text-sm text-gray-500 bg-gray-50 cursor-not-allowed';
const inputClassError = 'w-full px-4 py-2.5 border border-red-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all duration-200';

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
      // Check if times overlap
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
        // Overnight event: valid ranges are:
        // Range 1: startTime -> 23:59 (before midnight)
        // Range 2: 00:00 -> endTime (after midnight)
        // Cross-midnight: from in range 1, to in range 2
        const inRange1 = phase.fromTime >= eventStartTime && phase.fromTime <= '23:59' && phase.toTime >= eventStartTime && phase.toTime <= '23:59';
        const inRange2 = phase.fromTime >= '00:00' && phase.fromTime <= eventEndTime && phase.toTime >= '00:00' && phase.toTime <= eventEndTime;
        const crossMidnight = phase.fromTime >= eventStartTime && phase.fromTime <= '23:59' && phase.toTime >= '00:00' && phase.toTime <= eventEndTime;

        if (!inRange1 && !inRange2 && !crossMidnight) {
          phaseErrors.push(`Times must be between ${eventStartTime}-23:59 or 00:00-${eventEndTime} next day.`);
        }
      } else {
        // Normal single-day event bound check
        if (eventStartTime && eventEndTime) {
          if (phase.fromTime < eventStartTime) {
            phaseErrors.push(`From time must be at or after ${eventStartTime}`);
          }
          if (phase.toTime > eventEndTime) {
            phaseErrors.push(`To time must be at or before ${eventEndTime}`);
          }
        }
      }

      // Check from < to
      if (phase.fromTime >= phase.toTime) {
        // Only flag if both times are in the same range (not cross-midnight)
        if (!overMidnight || phase.fromTime < phase.toTime) {
          phaseErrors.push('To time must be after From time');
        }
      }

      // Check overlapping with other saved phases
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

    // Clear errors for this phase on change
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

    // Clean up saved phases
    const newSaved = { ...savedPhases };
    delete newSaved[index];
    const reindexed = {};
    Object.keys(newSaved).forEach((key) => {
      const keyNum = parseInt(key);
      reindexed[keyNum > index ? keyNum - 1 : keyNum] = newSaved[key];
    });
    setSavedPhases(reindexed);

    // Clean up errors
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

    // Clear errors for this phase
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

    // Clear errors
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const startEditing = (index) => {
    setSavedPhases(prev => ({ ...prev, [index]: false }));
    setEditingPhase(index);
    // Clear errors when editing
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const isPhaseSaved = (index) => savedPhases[index] === true;
  const hasErrors = (index) => errors[index] && errors[index].length > 0;

  return (
    <div className="pt-2 flex flex-col gap-4">
      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Activity Agenda</h2>
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
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors pt-1"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Add new phase</span>
        </button>
      </div>
    </div>
  );
}

function AgendaItem({ index, item, isSaved, errors, hasErrors, canRemove, onChange, onSave, onClear, onEdit, onRemove }) {
  const isComplete = item.fromTime && item.toTime && item.title && item.description;

  return (
    <div className={`p-4 border ppp-xl relative flex flex-col gap-3 transition-all duration-200 ${
      hasErrors ? 'bg-red-50 border-red-300' :
      isSaved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Phase {index + 1}</span>
          {isSaved && !hasErrors && (
            <span className="text-[10px] font-medium text-green-600 bg-green-100 px-2 py-0.5 ppp-full">
              Saved
            </span>
          )}
          {hasErrors && (
            <span className="text-[10px] font-medium text-red-600 bg-red-100 px-2 py-0.5 ppp-full">
              Has errors
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isSaved && !hasErrors && (
            <button type="button" onClick={() => onEdit(index)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1">
              Edit
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={() => onRemove(index)}
              className="p-1.5 text-gray-400 hover:text-red-600 ppp-md hover:bg-white transition-colors">
              <FiTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {hasErrors && (
        <div className="flex flex-col gap-1 p-2 bg-red-100 border border-red-200 ppp-lg">
          {errors.map((error, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700">
              <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="block text-[11px] font-medium text-gray-500">From Time</label>
          <input
            type="time"
            className={hasErrors ? inputClassError : isSaved ? inputClassDisabled : inputClass}
            value={item.fromTime}
            onChange={(e) => onChange(index, 'fromTime', e.target.value)}
            disabled={isSaved}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-[11px] font-medium text-gray-500">To Time</label>
          <input
            type="time"
            className={hasErrors ? inputClassError : isSaved ? inputClassDisabled : inputClass}
            value={item.toTime}
            onChange={(e) => onChange(index, 'toTime', e.target.value)}
            disabled={isSaved}
            required
          />
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="block text-[11px] font-medium text-gray-500">Title</label>
        <input
          type="text"
          className={hasErrors ? inputClassError : isSaved ? inputClassDisabled : inputClass}
          value={item.title}
          onChange={(e) => onChange(index, 'title', e.target.value)}
          placeholder="e.g. Introduction"
          disabled={isSaved}
          required
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="block text-[11px] font-medium text-gray-500">Description</label>
        <textarea
          className={`${hasErrors ? inputClassError : isSaved ? inputClassDisabled : inputClass} resize-y min-h-[60px]`}
          value={item.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          placeholder="Provide specific agenda item context details..."
          rows={2}
          disabled={isSaved}
          required
        />
      </div>

      {/* Action Buttons */}
      {!isSaved && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
          <button
            type="button"
            onClick={() => onSave(index)}
            disabled={!isComplete}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 ppp-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiCheck className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={() => onClear(index)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 ppp-lg border border-gray-200 transition-colors"
          >
            <FiX className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}