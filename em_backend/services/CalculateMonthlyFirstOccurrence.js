

module.exports = function CalculateMonthlyFirstOccurrence(now, monthlyPattern, monthlyDates, startHours, startMinutes) {
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let targetDate;

    switch (monthlyPattern) {
      case 'specific':
        { if (!monthlyDates || monthlyDates.length === 0) {
          throw new Error('Monthly specific pattern requires dates');
        }
        
        // Sort dates and find next occurrence
        const sortedDates = [...monthlyDates].sort((a, b) => a - b);
        let nextDate = sortedDates.find(date => date > currentDate);
        
        if (nextDate) {
          targetDate = new Date(currentYear, currentMonth, nextDate);
        } else {
          // Move to next month, first date
          targetDate = new Date(currentYear, currentMonth + 1, sortedDates[0]);
        }
        break; }

      case 'firstDay':
        targetDate = new Date(currentYear, currentMonth + 1, 1);
        break;

      case 'lastDay':
        targetDate = new Date(currentYear, currentMonth + 2, 0);
        break;

      case 'firstTwoWeeks':
        if (currentDate <= 14) {
          // Still in first two weeks of current month
          targetDate = new Date(currentYear, currentMonth, Math.max(currentDate + 1, 1));
        } else {
          // Move to first day of next month
          targetDate = new Date(currentYear, currentMonth + 1, 1);
        }
        break;

      case 'lastTwoWeeks':
        { const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startOfLastTwoWeeks = lastDayOfMonth - 13;
        
        if (currentDate >= startOfLastTwoWeeks) {
          targetDate = new Date(currentYear, currentMonth, Math.max(currentDate + 1, startOfLastTwoWeeks));
        } else {
          // Move to start of last two weeks
          targetDate = new Date(currentYear, currentMonth, startOfLastTwoWeeks);
        }
        break; }

      case 'mixed':
        // Default to first day of next month
        targetDate = new Date(currentYear, currentMonth + 1, 1);
        break;

      default:
        throw new Error('Invalid monthly pattern');
    }

    // Ensure the date is valid (handle month overflow)
    if (targetDate.getMonth() !== (currentMonth + 1) % 12 && monthlyPattern !== 'specific') {
      targetDate = new Date(currentYear, currentMonth + 1, 1);
    }

    targetDate.setHours(startHours, startMinutes, 0, 0);
    return targetDate;
  }