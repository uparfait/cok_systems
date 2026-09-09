// Due dates may arrive as date-only strings ("2026-09-10") from older
// clients; those parse to midnight and would read as overdue for the whole
// day. A date-only value is pushed to the end of that day so overdue
// checks compare real hours. Values that already carry a time are kept.
function normalizeDueDate(dueDate) {
  if (!dueDate) return dueDate;
  if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
    const end = new Date(`${dueDate.trim()}T23:59:59.999`);
    if (!isNaN(end.getTime())) return end;
  }
  return dueDate;
}

module.exports = normalizeDueDate;
