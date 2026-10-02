/**
 * Vehicle movement (check-ins and check-outs) for the gate dashboard chart,
 * over a chosen period, grouped by hour, day, week, month or year in Kigali
 * time. Counts are whole numbers of vehicles.
 *
 * GET /statistics/parking-movement?range=today|yesterday|week|month|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

const ParkingRecord = require('../../models/parking_record.js');

const TIMEZONE = 'Africa/Kigali';
const OFFSET_MS = 2 * 60 * 60 * 1000; // Rwanda is UTC+2 all year
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const UNITS = ['hour', 'day', 'week', 'month', 'year'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANGES = {
    today: { label: 'Today', unit: 'hour' },
    yesterday: { label: 'Yesterday', unit: 'hour' },
    week: { label: 'This Week', unit: 'day' },
    month: { label: 'This Month', unit: 'day' },
    year: { label: 'This Year', unit: 'month' },
};

/** Kigali wall-clock fields of an instant (read with getUTC*). */
const local = (ms) => new Date(ms + OFFSET_MS);
const fromLocal = (y, m, d = 1, h = 0) => Date.UTC(y, m, d, h) - OFFSET_MS;

/** Start of the unit that contains the instant, as an instant. */
function startOf(unit, ms) {
    const t = local(ms);
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth();
    const d = t.getUTCDate();
    if (unit === 'hour') return fromLocal(y, m, d, t.getUTCHours());
    if (unit === 'day') return fromLocal(y, m, d);
    if (unit === 'week') return fromLocal(y, m, d - ((t.getUTCDay() + 6) % 7));
    if (unit === 'month') return fromLocal(y, m);
    return fromLocal(y, 0);
}

/** The instant one unit later (calendar aware for months and years). */
function next(unit, ms) {
    if (unit === 'hour') return ms + HOUR;
    if (unit === 'day') return ms + DAY;
    if (unit === 'week') return ms + 7 * DAY;
    const t = local(ms);
    if (unit === 'month') return fromLocal(t.getUTCFullYear(), t.getUTCMonth() + 1);
    return fromLocal(t.getUTCFullYear() + 1, 0);
}

/** Hours inside two days, days inside 45, weeks inside half a year, months inside 3 years, then years. */
function unitForSpan(ms) {
    if (ms <= 2 * DAY) return 'hour';
    if (ms <= 45 * DAY) return 'day';
    if (ms <= 183 * DAY) return 'week';
    if (ms <= 1096 * DAY) return 'month';
    return 'year';
}

const coarser = (a, b) => (UNITS.indexOf(a) >= UNITS.indexOf(b) ? a : b);
const pad = (n) => String(n).padStart(2, '0');

function bucketLabel(unit, ms, multiDay) {
    const t = local(ms);
    const day = `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
    if (unit === 'hour') return multiDay ? `${day} ${pad(t.getUTCHours())}:00` : `${pad(t.getUTCHours())}:00`;
    if (unit === 'day') return `${WEEKDAYS[t.getUTCDay()]} ${day}`;
    if (unit === 'week') return `Week of ${day}`;
    if (unit === 'month') return `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
    return String(t.getUTCFullYear());
}

const dateLabel = (ms) => {
    const t = local(ms);
    return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};

/** YYYY-MM-DD as the start of that Kigali day, or null. */
function parseDay(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const ms = fromLocal(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(ms) ? null : ms;
}

/** The period asked for: { key, label, from, to, unit }, `to` exclusive. */
function requestedPeriod(query, now) {
    const key = (RANGES[query.range] || query.range === 'custom') ? query.range : 'year';
    if (key === 'custom') {
        const from = parseDay(query.from);
        const toDay = parseDay(query.to);
        if (from === null || toDay === null) return { error: 'Choose a valid From and To date (YYYY-MM-DD)' };
        if (toDay < from) return { error: 'The To date must be on or after the From date' };
        const to = Math.min(toDay + DAY, now);
        if (to <= from) return { error: 'The period has not started yet' };
        return { key, label: `${dateLabel(from)} - ${dateLabel(toDay)}`, from, to, unit: unitForSpan(to - from) };
    }
    const today = startOf('day', now);
    if (key === 'today') return { key, ...RANGES.today, from: today, to: now };
    if (key === 'yesterday') return { key, ...RANGES.yesterday, from: today - DAY, to: today };
    if (key === 'week') return { key, ...RANGES.week, from: startOf('week', now), to: now };
    if (key === 'month') return { key, ...RANGES.month, from: startOf('month', now), to: now };
    return { key: 'year', ...RANGES.year, from: startOf('year', now), to: now };
}

const countBy = (field, unit, from, to) => ParkingRecord.aggregate([
    { $match: { [field]: { $gte: new Date(from), $lt: new Date(to) } } },
    { $group: { _id: { $dateTrunc: { date: `$${field}`, unit, timezone: TIMEZONE, ...(unit === 'week' ? { startOfWeek: 'monday' } : {}) } }, n: { $sum: 1 } } },
]);

const firstOf = (field, from, to) => ParkingRecord.findOne({ [field]: { $gte: new Date(from), $lt: new Date(to) } })
    .sort({ [field]: 1 }).select(field).lean();

async function getParkingMovement(req, res) {
    try {
        const now = Date.now();
        const period = requestedPeriod(req.query || {}, now);
        if (period.error) return res.status(400).json({ success: false, type: 'warning', message: period.error });

        const live = period.to >= now - 60 * 1000;
        const [earliestInside, firstIn, firstOut, totalIn, totalOut] = await Promise.all([
            live ? ParkingRecord.findOne({ status: 'active' }).sort({ check_in: 1 }).select('check_in plate_number').lean() : null,
            firstOf('check_in', period.from, period.to),
            firstOf('check_out', period.from, period.to),
            ParkingRecord.countDocuments({ check_in: { $gte: new Date(period.from), $lt: new Date(period.to) } }),
            ParkingRecord.countDocuments({ check_out: { $gte: new Date(period.from), $lt: new Date(period.to) } }),
        ]);

        // The chart starts at the first movement of the period, or earlier at
        // the arrival of the oldest car still inside, so no car appears from nowhere
        const starts = [firstIn && firstIn.check_in, firstOut && firstOut.check_out]
            .filter(Boolean).map((d) => new Date(d).getTime());
        const insideSince = earliestInside && earliestInside.check_in ? new Date(earliestInside.check_in).getTime() : null;
        if (insideSince !== null && insideSince < period.from) starts.push(insideSince);
        const windowFrom = starts.length ? Math.min(...starts) : period.from;
        const unit = coarser(period.unit, unitForSpan(period.to - windowFrom));

        const [ins, outs] = await Promise.all([
            countBy('check_in', unit, windowFrom, period.to),
            countBy('check_out', unit, windowFrom, period.to),
        ]);
        const inMap = new Map(ins.map((row) => [new Date(row._id).getTime(), row.n]));
        const outMap = new Map(outs.map((row) => [new Date(row._id).getTime(), row.n]));

        const first = startOf(unit, windowFrom);
        const multiDay = unit === 'hour' && startOf('day', first) !== startOf('day', period.to - 1);
        const points = [];
        for (let at = first; at < period.to && points.length < 400; at = next(unit, at)) {
            points.push({
                key: new Date(at).toISOString(),
                label: bucketLabel(unit, at, multiDay),
                check_in: inMap.get(at) || 0,
                check_out: outMap.get(at) || 0,
            });
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Vehicle movement retrieved',
            data: {
                range: period.key,
                label: period.label,
                unit,
                from: new Date(period.from).toISOString(),
                to: new Date(period.to).toISOString(),
                chart_from: new Date(first).toISOString(),
                earliest_inside: insideSince !== null ? { check_in: new Date(insideSince).toISOString(), plate_number: earliestInside.plate_number } : null,
                totals: { check_in: totalIn, check_out: totalOut },
                points,
            },
        });
    } catch (error) {
        console.error('Error in getParkingMovement:', error);
        return res.status(500).json({ success: false, type: 'error', message: 'Failed to load vehicle movement', error: error.message });
    }
}

module.exports = { getParkingMovement, requestedPeriod, unitForSpan, startOf };
