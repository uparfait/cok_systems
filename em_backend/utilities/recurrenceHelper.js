/**
 * Shared recurrence utility used by CheckRoomAvailability and GetAvailableRooms
 */

class recurrenceHelper {
  /**
   * Check if a recurring event overlaps with a given time range
   */
  static isRecurringOverlapping(recurringEvent, requestStart, requestEnd) {
    const { recurringType, weeklyDays, monthlyDates, monthlyPattern, eventStartTime, eventEndTime } =
      recurringEvent.eventRecurring;

    const [eventStartHour, eventStartMin] = eventStartTime.split(':').map(Number);
    const [eventEndHour, eventEndMin] = eventEndTime.split(':').map(Number);

    let currentDate = new Date(requestStart);
    currentDate.setDate(currentDate.getDate() - 1);
    currentDate.setHours(0, 0, 0, 0);

    const endDate = new Date(recurringEvent.eventRecurring.recurringEndDate);

    while (currentDate <= endDate && currentDate <= requestEnd) {
      let hasEvent = false;
      let eventStartDateTime = null;
      let eventEndDateTime = null;
      let dayMatches = false;

      switch (recurringType) {
        case 'Daily':
          dayMatches = true;
          break;
        case 'Weekly':
          if (weeklyDays && weeklyDays.includes(currentDate.getDay())) {
            dayMatches = true;
          }
          break;
        case 'Monthly':
          if (this.isMonthlyDateMatch(currentDate, monthlyPattern, monthlyDates)) {
            dayMatches = true;
          }
          break;
      }

      if (dayMatches) {
        eventStartDateTime = new Date(currentDate);
        eventStartDateTime.setHours(eventStartHour, eventStartMin, 0, 0);

        eventEndDateTime = new Date(currentDate);
        eventEndDateTime.setHours(eventEndHour, eventEndMin, 0, 0);

        if (eventEndHour < eventStartHour || (eventEndHour === eventStartHour && eventEndMin <= eventStartMin)) {
          eventEndDateTime.setDate(eventEndDateTime.getDate() + 1);
        }

        hasEvent = true;
      }

      if (hasEvent && eventStartDateTime && eventEndDateTime) {
        if (eventStartDateTime < requestEnd && eventEndDateTime > requestStart) {
          return true;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return false;
  }

  /**
   * Generate all occurrence dates between start and end based on recurring config
   */
  static generateOccurrenceDates(startDate, endDate, recurringType, weeklyDays, monthlyDates, monthlyPattern) {
    const dates = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      let matches = false;

      switch (recurringType) {
        case 'Daily':
          matches = true;
          break;
        case 'Weekly':
          if (weeklyDays && weeklyDays.includes(current.getDay())) {
            matches = true;
          }
          break;
        case 'Monthly':
          matches = this.isMonthlyDateMatch(current, monthlyPattern, monthlyDates);
          break;
      }

      if (matches) {
        dates.push(new Date(current));
      }

      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Check if a given date matches a monthly pattern
   */
  static isMonthlyDateMatch(date, monthlyPattern, monthlyDates) {
    const dayOfMonth = date.getDate();
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    switch (monthlyPattern) {
      case 'specific':
        return monthlyDates && monthlyDates.includes(dayOfMonth);
      case 'firstDay':
        return dayOfMonth === 1;
      case 'lastDay':
        return dayOfMonth === lastDayOfMonth;
      case 'firstTwoWeeks':
        return dayOfMonth >= 1 && dayOfMonth <= 14;
      case 'lastTwoWeeks':
        return dayOfMonth >= lastDayOfMonth - 13 && dayOfMonth <= lastDayOfMonth;
      case 'mixed':
        return monthlyDates && monthlyDates.includes(dayOfMonth);
      default:
        return false;
    }
  }
}

module.exports = recurrenceHelper;
