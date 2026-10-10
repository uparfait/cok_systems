const ExcelJS = require('exceljs');
const ServiceDelivery = require('../../models/service_delivery.js');
const { departmentScopeFor, sendError, badRequest } = require('../../utilities/visitors');

/**
 * GET /servicedelivery/visitors/export and GET /visitors/export
 * One spreadsheet row per visit (servicedeliveries), each joined with the
 * visitor it references. Query:
 *  - period: today | week | month | last_month | year | range (default month,
 *    or range when only from / to are sent), from, to (dates, on entry_date);
 *  - vehicle: with_vehicle | without_vehicle | all;
 *  - presence: in_house | not_in_house | all (default all): whether the
 *    visit is still open;
 *  - scope=mine: only visits sent to the caller's departments;
 *  - title, fields (comma separated column keys, default all), format=xlsx.
 */

const DEFAULT_TITLE = 'Visitors Data Report';

const getPeriodBounds = (period, from, to) => {
  const now = new Date();
  const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const endOfDay = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

  if (period === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (period === 'week') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'range' && (from || to)) {
    const start = from ? startOfDay(from) : null;
    const end = to ? endOfDay(to) : endOfDay(now);
    return { start, end };
  }
  return null;
};

const formatDuration = (duration) => {
  if (!duration) return '';
  const totalMinutes = parseInt(duration, 10);
  if (isNaN(totalMinutes) || totalMinutes <= 0) return '';

  const minute = 1;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  let remaining = totalMinutes;
  const parts = [];

  const years = Math.floor(remaining / year);
  if (years > 0) { parts.push(`${years}year(s)`); remaining -= years * year; }

  const months = Math.floor(remaining / month);
  if (months > 0) { parts.push(`${months}month(s)`); remaining -= months * month; }

  const days = Math.floor(remaining / day);
  if (days > 0) { parts.push(`${days}day(s)`); remaining -= days * day; }

  const hours = Math.floor(remaining / hour);
  if (hours > 0) { parts.push(`${hours}hour(s)`); remaining -= hours * hour; }

  const mins = remaining;
  if (mins > 0) { parts.push(`${mins}min`); }

  return parts.join('');
};

const pad2 = (value) => String(value).padStart(2, '0');
const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());
const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
};

// Server-local time for the date and the hours alike
const localDay = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatDateRange = (entryDate, exitDate) => {
  const entry = toDate(entryDate);
  if (!entry) return '';
  const exit = toDate(exitDate);
  if (!exit) return localDay(entry);
  return localDay(entry) === localDay(exit) ? localDay(entry) : `${localDay(entry)} - ${localDay(exit)}`;
};

const formatHour = (value) => {
  const date = toDate(value);
  return date ? `${pad2(date.getHours())}:${pad2(date.getMinutes())}` : '';
};

const lines = (values) => (values || []).filter(Boolean).join('\n');
const byWhom = (name) => (name && name !== 'Not specified' ? ` (${name})` : '');

// Column key -> header and cell value of a visit row (see visitRowPipeline)
const COLUMNS = {
  identification: { header: 'Identification', value: (v) => v.identification.number },
  identification_type: { header: 'Identification Type', value: (v) => v.identification.id_type },
  plate_number: { header: 'Plate Number', value: (v) => (v.has_vehicle ? v.plate_number : '') },
  full_name: { header: 'Full Name', value: (v) => v.full_name },
  telephone: { header: 'Telephone', value: (v) => v.telephone },
  email: { header: 'Email', value: (v) => v.email },
  gender: { header: 'Gender', value: (v) => v.gender },
  n_visits: { header: 'Number of Visits', value: (v) => (v.visitor_id ? v.N_visits : '') },
  in_house: { header: 'In House', value: (v) => (v.Is_In_House ? 'Yes' : 'No') },
  date: { header: 'Date', value: (v) => formatDateRange(v.entry_date, v.exist_date) },
  from_hour: { header: 'From', value: (v) => formatHour(v.entry_date) },
  to_hour: { header: 'To', value: (v) => formatHour(v.exist_date) },
  duration: { header: 'Duration', value: (v) => formatDuration(v.visit_duration) },
  departments_assigned: { header: 'Oriented To', value: (v) => lines(v.departments) },
  services: {
    header: 'Services',
    value: (v) => lines(v.services.map((s) => `${s.department_name || 'Department'}: ${s.s_type || 'Not started'}${byWhom(s.provider_name)}`)),
  },
  service_durations: {
    header: 'Service Durations',
    value: (v) => lines(v.service_durations.map((d) => `${d.department_name || 'Department'}: ${d.duration ? (formatDuration(d.duration) || '0min') : 'in progress'}${byWhom(d.provider_name)}`)),
  },
};

// Names the visitors page uses for the same columns
const FIELD_ALIASES = {
  id_type: 'identification_type',
  id_number: 'identification',
  N_visits: 'n_visits',
  visits: 'n_visits',
  Is_In_House: 'in_house',
  is_in_house: 'in_house',
  departments: 'departments_assigned',
  oriented_to: 'departments_assigned',
};

// Always the last columns, in this order
const DATE_COLUMNS = ['date', 'from_hour', 'to_hour', 'duration'];

function selectedColumns(raw) {
  const requested = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => String(value === undefined || value === null ? '' : value).split(','))
    .map((key) => key.trim())
    .filter(Boolean);
  const keys = requested.length
    ? [...new Set(requested.map((key) => FIELD_ALIASES[key] || key).filter((key) => COLUMNS[key]))]
    : Object.keys(COLUMNS);
  if (keys.length === 0) throw badRequest('Choose at least one valid column to export');
  return [...keys.filter((key) => !DATE_COLUMNS.includes(key)), ...DATE_COLUMNS.filter((key) => keys.includes(key))];
}

function readQuery(query = {}) {
  const one = (key) => {
    const value = Array.isArray(query[key]) ? query[key][0] : query[key];
    return value === undefined || value === null ? '' : String(value).trim();
  };
  const from = one('from') || undefined;
  const to = one('to') || undefined;
  return {
    period: one('period') || (from || to ? 'range' : 'month'),
    from,
    to,
    vehicle: one('vehicle'),
    presence: one('presence'),
    scope: one('scope'),
    title: one('title') || DEFAULT_TITLE,
    format: (one('format') || 'xlsx').toLowerCase(),
  };
}

async function buildMatch(req, q) {
  const match = {};

  const bounds = getPeriodBounds(q.period, q.from, q.to);
  if (bounds) {
    if ((bounds.start && !isValidDate(bounds.start)) || !isValidDate(bounds.end)) {
      throw badRequest('Choose valid From and To dates');
    }
    match.entry_date = bounds.start ? { $gte: bounds.start, $lte: bounds.end } : { $lte: bounds.end };
  }

  if (q.vehicle === 'with_vehicle') match['vehicle_storage.has_vehicle'] = true;
  else if (q.vehicle === 'without_vehicle') match['vehicle_storage.has_vehicle'] = { $ne: true };

  if (q.presence === 'in_house') match.is_still_inhouse = true;
  else if (q.presence === 'not_in_house') match.is_still_inhouse = false;

  if (q.scope === 'mine') {
    const departments = await departmentScopeFor(req.user, req.navigation && req.navigation.role_slug);
    match['departments_assigned.department_id'] = { $in: departments };
  }
  return match;
}

// The visitor's value, else the one visits of the old structure stored themselves
const visitorField = (path, legacyPath, fallback = '') => ({ $ifNull: [`$person.${path}`, { $ifNull: [`$${legacyPath}`, fallback] }] });

/** Visits (oldest first) with the visitor's details as flat fields. */
const visitRowPipeline = (match) => [
  { $match: match },
  { $sort: { entry_date: 1, _id: 1 } },
  {
    $lookup: {
      from: 'visitors',
      localField: 'visitor',
      foreignField: '_id',
      pipeline: [{ $project: { identification: 1, full_name: 1, telephone: 1, email: 1, gender: 1, N_visits: 1, Is_In_House: 1 } }],
      as: 'person',
    },
  },
  { $set: { person: { $ifNull: [{ $arrayElemAt: ['$person', 0] }, null] } } },
  {
    $project: {
      visitor_id: '$person._id',
      identification: {
        id_type: visitorField('identification.id_type', 'identification.id_type'),
        number: visitorField('identification.number', 'identification.number'),
      },
      full_name: visitorField('full_name', 'full_name'),
      telephone: visitorField('telephone', 'telephone'),
      email: visitorField('email', 'email'),
      gender: visitorField('gender', 'gender'),
      N_visits: { $ifNull: ['$person.N_visits', 0] },
      Is_In_House: { $ifNull: ['$person.Is_In_House', { $ifNull: ['$is_still_inhouse', false] }] },
      entry_date: 1,
      exist_date: 1,
      has_vehicle: { $ifNull: ['$vehicle_storage.has_vehicle', false] },
      plate_number: { $ifNull: ['$vehicle_storage.vehicle_details.plate_number', ''] },
      visit_duration: '$durations.entry_and_leave_duration',
      departments: { $ifNull: ['$departments_assigned.department_name', []] },
      services: {
        $map: {
          input: { $ifNull: ['$services_status', []] },
          as: 's',
          in: { department_name: '$$s.department_name', provider_name: '$$s.provider_name', s_type: '$$s.s_type' },
        },
      },
      service_durations: {
        $map: {
          input: { $ifNull: ['$durations.services_durations', []] },
          as: 'd',
          in: { department_name: '$$d.department_name', provider_name: '$$d.provider_name', duration: '$$d.duration' },
        },
      },
    },
  },
];

function buildSheet(workbook, title, columns) {
  const sheet = workbook.addWorksheet('Visitors Data');

  if (columns.length > 1) sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, color: { argb: 'FF056daa' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  const headerRow = sheet.getRow(2);
  columns.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = COLUMNS[key].header;
    cell.font = { bold: true, color: { argb: 'FF056daa' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  });
  headerRow.height = 20;
  return sheet;
}

function fitColumns(sheet, columns) {
  columns.forEach((_, index) => {
    const column = sheet.getColumn(index + 1);
    column.alignment = { vertical: 'middle', wrapText: true };
    column.width = 25;
  });

  sheet.columns.forEach((col) => {
    let maxLength = 15;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = len;
    });
    if (col.width && col.width < maxLength) col.width = Math.min(maxLength + 2, 50);
  });
}

module.exports = async function export_visitors(req, res) {
  try {
    const q = readQuery(req.query || {});
    if (q.format !== 'xlsx') throw badRequest('Only the xlsx format is supported');
    const columns = selectedColumns(req.query && req.query.fields);
    const match = await buildMatch(req, q);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CoK Systems';
    workbook.created = new Date();
    const sheet = buildSheet(workbook, q.title, columns);

    const cursor = ServiceDelivery.aggregate(visitRowPipeline(match)).allowDiskUse(true).cursor();
    for await (const visit of cursor) {
      sheet.addRow(columns.map((key) => COLUMNS[key].value(visit)));
    }
    fitColumns(sheet, columns);

    const buffer = await workbook.xlsx.writeBuffer();
    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${q.title.replace(/[^a-z0-9]/gi, '_')}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return sendError(res, error, 'Something went wrong while generating the visitors report');
  }
};
