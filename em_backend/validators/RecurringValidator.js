class RecurringValidator {
  static validate(data) {
    const errors = [];

    if (!data.eventRecurring) {
      errors.push('Recurring configuration is required');
      return { isValid: false, errors };
    }

    const recurring = data.eventRecurring;

    // Validate recurring type
    if (!['Daily', 'Weekly', 'Monthly'].includes(recurring.recurringType)) {
      errors.push('Invalid recurring type');
    }

    // Validate dates
    if (!recurring.recurringEndDate || isNaN(Date.parse(recurring.recurringEndDate))) {
      errors.push('Recurring end date is required and must be valid');
    } else {
      const endDate = new Date(recurring.recurringEndDate);
      const now = new Date();
      if (endDate <= now) {
        errors.push('Recurring end date must be in the future');
      }
    }

    // Validate universal event times (for all recurring types)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    
    if (!recurring.eventStartTime || !timeRegex.test(recurring.eventStartTime)) {
      errors.push('Valid event start time (HH:MM) is required for recurring events');
    }
    
    if (!recurring.eventEndTime || !timeRegex.test(recurring.eventEndTime)) {
      errors.push('Valid event end time (HH:MM) is required for recurring events');
    }
    
    if (recurring.eventStartTime && recurring.eventEndTime && recurring.eventStartTime >= recurring.eventEndTime) {
      errors.push('Event end time must be after start time');
    }

    // Validate weekly days
    if (recurring.recurringType === 'Weekly') {
      if (!Array.isArray(recurring.weeklyDays) || recurring.weeklyDays.length === 0) {
        errors.push('Weekly recurring requires at least one day');
      } else {
        const invalidDays = recurring.weeklyDays.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          errors.push('Weekly days must be between 0 and 6');
        }
      }
    }

    // Validate monthly dates and pattern
    if (recurring.recurringType === 'Monthly') {
      // Validate monthly pattern
      const validPatterns = ['specific', 'firstDay', 'lastDay', 'firstTwoWeeks', 'lastTwoWeeks', 'mixed'];
      if (recurring.monthlyPattern && !validPatterns.includes(recurring.monthlyPattern)) {
        errors.push('Invalid monthly pattern');
      }

      // Validate dates for specific and mixed patterns
      if (!recurring.monthlyPattern || recurring.monthlyPattern === 'specific' || recurring.monthlyPattern === 'mixed') {
        if (!Array.isArray(recurring.monthlyDates) || recurring.monthlyDates.length === 0) {
          errors.push('Monthly recurring requires at least one date for the selected pattern');
        } else {
          const invalidDates = recurring.monthlyDates.filter(date => date < 1 || date > 31);
          if (invalidDates.length > 0) {
            errors.push('Monthly dates must be between 1 and 31');
          }
        }
      }
    }

    // Validate expiration
    if (recurring.willExpire === true) {
      if (!recurring.willExpireAt || isNaN(Date.parse(recurring.willExpireAt))) {
        errors.push('Expiry date is required when willExpire is true');
      } else {
        const expireAt = new Date(recurring.willExpireAt);
        if (expireAt <= new Date()) {
          errors.push('Expiry date must be in the future');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = RecurringValidator;