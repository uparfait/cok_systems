/**
 * Vehicle movement for the gate dashboard chart: check-ins, check-outs and
 * vehicles flagged for overstaying, over a chosen period, grouped by hour,
 * day, week, month or year in Kigali time. Counts are whole numbers.
 * Each point also says how many of the cars that entered in it have already
 * left (entered_left), whenever they left.
 *
 * GET /statistics/parking-movement?range=default|today|yesterday|week|month|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 * The default period is today, or - when a car still inside, or a car that
 * left today, arrived before today - from the day that car arrived until now.
 * Check-ins always count on the day they happened and check-outs on theirs.
 * Only smart parking records (cars) are counted, never visitor visits.
 */

const ParkingRecord = require('../../models/parking_record.js');

const TIMEZONE = 'Africa/Kigali';
const OFFSET_MS = 2 * 60 * 60 * 1000; // Rwanda is UTC+2 all year
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANGES = {
    today: { label: 'Today', unit: 'hour' },
    yesterday: { label: 'Yesterday', unit: 'hour' },
    week: { label: 'This Week', unit: 'day' },
    month: { label: 'This Month', unit: 'day' },
    year: { label: 'This Year', unit: 'month' },
};
const SERIES = [
    { key: 'check_in', field: 'check_in' },
    { key: 'check_out', field: 'check_out' },
    { key: 'flagged', field: 'flagged_at' },
];

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

/** Kigali calendar day of an instant as YYYY-MM-DD. */
const dayString = (ms) => {
    const t = local(ms);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/**
 * YYYY-MM-DD or YYYY-MM-DDTHH:MM in Kigali time, or null. A day alone is its
 * start, or its end when `end` is set; T24:00 is the end of that day.
 */
function parseMoment(value, end = false) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(value || '').trim());
    if (!match) return null;
    const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
    if (match[4] === undefined) {
        const day = fromLocal(y, m, d);
        if (Number.isNaN(day)) return null;
        return end ? day + DAY : day;
    }
    const h = Number(match[4]);
    const min = Number(match[5]);
    if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
    const ms = fromLocal(y, m, d, h) + min * 60 * 1000;
    return Number.isNaN(ms) ? null : ms;
}

/** YYYY-MM-DDTHH:MM for the date and hour fields; an end at midnight reads as 24:00 of the day before. */
function inputValue(ms, end = false) {
    const t = local(ms);
    if (end && ms === startOf('day', ms)) return `${dayString(ms - DAY)}T24:00`;
    return `${dayString(ms)}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

const timeLabel = (ms) => {
    const t = local(ms);
    return `${dateLabel(ms)} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
};

/** A custom period from `from` to `end` (exclusive), shown until now at most. */
function customPeriod(from, end, now, auto = false) {
    const wholeDays = from === startOf('day', from) && end === startOf('day', end);
    const label = wholeDays ? `${dateLabel(from)} - ${dateLabel(end - DAY)}` : `${timeLabel(from)} - ${timeLabel(end)}`;
    const to = Math.min(end, now);
    return { key: 'custom', auto, label, from, to, end, unit: unitForSpan(to - from) };
}

/**
 * The period to show: { key, label, from, to, unit, auto }, `to` exclusive.
 * `carriedSince` is the earliest arrival of a car still inside or that left
 * today: the default period starts that day, so its check-in shows on the day
 * it happened and its check-out on today.
 */
function requestedPeriod(query, now, carriedSince) {
    const today = startOf('day', now);
    const range = query.range;
    if (range === 'custom') {
        const from = parseMoment(query.from);
        const end = parseMoment(query.to, true);
        if (from === null || end === null) return { error: 'Choose a valid From and To (YYYY-MM-DD or YYYY-MM-DDTHH:MM)' };
        if (end <= from) return { error: 'The To time must be after the From time' };
        if (from >= now) return { error: 'The period has not started yet' };
        return customPeriod(from, end, now);
    }
    if (range === 'today') return { key: 'today', ...RANGES.today, from: today, to: now };
    if (range === 'yesterday') return { key: 'yesterday', ...RANGES.yesterday, from: today - DAY, to: today };
    if (range === 'week') return { key: 'week', ...RANGES.week, from: startOf('week', now), to: now };
    if (range === 'month') return { key: 'month', ...RANGES.month, from: startOf('month', now), to: now };
    if (range === 'year') return { key: 'year', ...RANGES.year, from: startOf('year', now), to: now };
    // Default: today, or from the day the oldest car still inside (or that left today) arrived
    if (carriedSince !== null && carriedSince < today) return customPeriod(startOf('day', carriedSince), today + DAY, now, true);
    return { key: 'today', ...RANGES.today, from: today, to: now, auto: true };
}

const inPeriod = (from, to) => ({ $gte: new Date(from), $lt: new Date(to) });

const bucketOf = (field, unit) => ({ $dateTrunc: { date: `$${field}`, unit, timezone: TIMEZONE, ...(unit === 'week' ? { startOfWeek: 'monday' } : {}) } });

const countBy = (field, unit, from, to) => ParkingRecord.aggregate([
    { $match: { [field]: inPeriod(from, to) } },
    { $group: { _id: bucketOf(field, unit), n: { $sum: 1 } } },
]);

/** Of the cars that entered in each bucket, how many have already left (whenever they left). */
const leftBy = (unit, from, to) => ParkingRecord.aggregate([
    { $match: { check_in: inPeriod(from, to), check_out: { $ne: null } } },
    { $group: { _id: bucketOf('check_in', unit), n: { $sum: 1 } } },
]);

async function getParkingMovement(req, res) {
    try {
        const now = Date.now();
        const today = startOf('day', now);
        const [earliestInside, earliestLeftToday] = await Promise.all([
            ParkingRecord.findOne({ status: 'active' }).sort({ check_in: 1 }).select('check_in plate_number').lean(),
            ParkingRecord.findOne({ check_out: { $gte: new Date(today) }, check_in: { $lt: new Date(today) } }).sort({ check_in: 1 }).select('check_in check_out plate_number').lean(),
        ]);
        const insideSince = earliestInside && earliestInside.check_in ? new Date(earliestInside.check_in).getTime() : null;
        const leftSince = earliestLeftToday && earliestLeftToday.check_in ? new Date(earliestLeftToday.check_in).getTime() : null;
        // The car the default period starts with: still inside, or came earlier and left today
        const carried = [
            insideSince !== null ? { at: insideSince, plate_number: earliestInside.plate_number, still_inside: true } : null,
            leftSince !== null ? { at: leftSince, plate_number: earliestLeftToday.plate_number, still_inside: false } : null,
        ].filter(Boolean).sort((a, b) => a.at - b.at)[0] || null;
        const period = requestedPeriod(req.query || {}, now, carried ? carried.at : null);
        if (period.error) return res.status(400).json({ success: false, type: 'warning', message: period.error });
        const unit = period.unit;

        // The whole period is shown, every hour / day / month up to now, empty ones included
        const [totals, counted, left] = await Promise.all([
            Promise.all(SERIES.map((s) => ParkingRecord.countDocuments({ [s.field]: inPeriod(period.from, period.to) }))),
            Promise.all(SERIES.map((s) => countBy(s.field, unit, period.from, period.to))),
            leftBy(unit, period.from, period.to),
        ]);
        const maps = counted.map((rows) => new Map(rows.map((row) => [new Date(row._id).getTime(), row.n])));
        const leftMap = new Map(left.map((row) => [new Date(row._id).getTime(), row.n]));

        const first = startOf(unit, period.from);
        const multiDay = unit === 'hour' && startOf('day', first) !== startOf('day', period.to - 1);
        const points = [];
        for (let at = first; at < period.to && points.length < 400; at = next(unit, at)) {
            const point = { key: new Date(at).toISOString(), label: bucketLabel(unit, at, multiDay) };
            SERIES.forEach((s, i) => { point[s.key] = maps[i].get(at) || 0; });
            // Cars that entered in this bucket and already left (shown inside the check-in bar)
            point.entered_left = leftMap.get(at) || 0;
            points.push(point);
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Vehicle movement retrieved',
            data: {
                range: period.key,
                auto: !!period.auto,
                label: period.label,
                unit,
                from: new Date(period.from).toISOString(),
                to: new Date(period.to).toISOString(),
                from_day: dayString(period.from),
                to_day: dayString(period.to - 1),
                from_input: inputValue(period.from),
                to_input: inputValue(period.end || period.to, true),
                chart_from: new Date(first).toISOString(),
                earliest_inside: insideSince !== null ? { check_in: new Date(insideSince).toISOString(), plate_number: earliestInside.plate_number } : null,
                started_by: period.auto && period.key === 'custom' && carried
                    ? { check_in: new Date(carried.at).toISOString(), plate_number: carried.plate_number, still_inside: carried.still_inside }
                    : null,
                totals: { check_in: totals[0], check_out: totals[1], flagged: totals[2] },
                points,
            },
        });
    } catch (error) {
        console.error('Error in getParkingMovement:', error);
        return res.status(500).json({ success: false, type: 'error', message: 'Failed to load vehicle movement', error: error.message });
    }
}

module.exports = { getParkingMovement, requestedPeriod, unitForSpan, startOf };
