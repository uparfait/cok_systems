/**
 * Get time portion from datetime-local value (HH:MM)
 */
export function getTimeFromDatetime(datetime) {
  if (!datetime) return null;
  const parts = datetime.split('T');
  if (parts.length === 2) return parts[1].substring(0, 5);
  return null;
}

/**
 * Get agenda time bounds with overnight detection.
 */
export function getAgendaTimeBounds(formData, eventMode) {
  let startTime = null;
  let endTime = null;
  let overMidnight = false;

  if (eventMode === 'live' && formData.startedAt && formData.willEndAt) {
    startTime = getTimeFromDatetime(formData.startedAt);
    endTime = getTimeFromDatetime(formData.willEndAt);
  } else if (eventMode === 'upcoming' && formData.willStartAt && formData.willEndAt) {
    startTime = getTimeFromDatetime(formData.willStartAt);
    endTime = getTimeFromDatetime(formData.willEndAt);
  } else if (eventMode === 'recurring' && formData.eventStartTime && formData.eventEndTime) {
    startTime = formData.eventStartTime;
    endTime = formData.eventEndTime;
  }

  // Detect overnight event: e.g. starts 09:20, ends 00:00 (next day)
  if (startTime && endTime && endTime <= startTime) {
    overMidnight = true;
  }

  return { startTime, endTime, overMidnight };
}

/**
 * Validate agenda times for both normal and overnight events.
 */
export function validateAgendaTimes(formData, eventMode, setError) {
  const { startTime, endTime, overMidnight } = getAgendaTimeBounds(formData, eventMode);
  if (!startTime || !endTime) return true;

  const savedAgenda = formData.agenda.filter(a => a.title.trim() && a.fromTime && a.toTime);
  for (const item of savedAgenda) {
    if (overMidnight) {
      const inRange1 = item.fromTime >= startTime && item.toTime >= startTime && item.fromTime <= '23:59' && item.toTime <= '23:59';
      const inRange2 = item.fromTime >= '00:00' && item.toTime >= '00:00' && item.fromTime <= endTime && item.toTime <= endTime;
      const crossMidnightValid = item.fromTime >= startTime && item.fromTime <= '23:59' && item.toTime >= '00:00' && item.toTime <= endTime;

      if (!inRange1 && !inRange2 && !crossMidnightValid) {
        setError(`Agenda times must be between ${startTime} and midnight, or midnight and ${endTime} next day.`);
        return false;
      }
      if (!crossMidnightValid && item.fromTime >= item.toTime) {
        if ((inRange1 && item.fromTime > item.toTime) || (inRange2 && item.fromTime > item.toTime)) {
          setError('Agenda "To Time" must be after "From Time"');
          return false;
        }
      }
    } else {
      if (item.fromTime < startTime || item.fromTime > endTime) {
        setError(`Agenda "From Time" (${item.fromTime}) must be between ${startTime} and ${endTime}`);
        return false;
      }
      if (item.toTime < startTime || item.toTime > endTime) {
        setError(`Agenda "To Time" (${item.toTime}) must be between ${startTime} and ${endTime}`);
        return false;
      }
      if (item.fromTime >= item.toTime) {
        setError('Agenda "To Time" must be after "From Time"');
        return false;
      }
    }
  }
  return true;
}

/**
 * Build organizer object from form fields.
 */
export function extractOrganizer(formData) {
  return {
    fullNames: formData.eventOrganizer,
    email: formData.organizerEmail,
    phone: formData.organizerPhone,
    institution: formData.organizerInstitution || '',
  };
}

/**
 * Build recurring config from form fields.
 */
export function buildRecurringConfig(formData, recurringType, monthlyPattern) {
  const config = {
    isRecurring: true,
    recurringType,
    recurringEndDate: new Date(formData.recurringEndDate).toISOString(),
    eventStartTime: formData.eventStartTime,
    eventEndTime: formData.eventEndTime,
    willExpire: false,
  };

  if (recurringType === 'Weekly') {
    config.weeklyDays = formData.weeklyDays;
  } else if (recurringType === 'Monthly') {
    config.monthlyPattern = monthlyPattern;
    if (monthlyPattern === 'specific' || monthlyPattern === 'mixed') {
      config.monthlyDates = formData.monthlyDates
        .split(',')
        .map(d => parseInt(d.trim()))
        .filter(d => !isNaN(d));
    }
  }

  return config;
}