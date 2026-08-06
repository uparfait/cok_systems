// Shared helpers for parking reservations (visitor + staff uploads)

// Plates are stored normalized (UPPERCASE, no spaces) so check-in/verify lookups always match
const normalizePlate = (p) => String(p || '').toUpperCase().replace(/\s+/g, '');

// Template date columns → reservation window. Start dates resolve to the START of that
// day, end dates to the END of that day. Template format is day/month/year (e.g.
// 31/12/2026, also - or . separators); JS Dates, Excel serial numbers, and ISO strings
// are accepted too. Missing/unreadable dates return null = that side is open-ended.
const parseTemplateDate = (raw, endOfDay = true) => {
    if (raw === undefined || raw === null || raw === '') return null;
    let d = null;
    if (raw instanceof Date) d = raw;
    else if (typeof raw === 'number') d = new Date(Math.round((raw - 25569) * 86400 * 1000)); // Excel serial day
    else {
        const s = String(raw).trim();
        const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // day/month/year
        d = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(s);
    }
    if (!d || isNaN(d.getTime())) return null;
    const out = new Date(d);
    if (endOfDay) out.setHours(23, 59, 59, 999);
    else out.setHours(0, 0, 0, 0);
    return out;
};

module.exports = { normalizePlate, parseTemplateDate };
