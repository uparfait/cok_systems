const ExcelJS = require('exceljs');
const ServiceDelivery = require('../../models/service_delivery.js');
const { getDepartmentIdsForHead } = require('../department_flow/visitors_by_status.js');

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
  if (period === 'range' && from) {
    const start = startOfDay(from);
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

const formatDateRange = (entryDate, exitDate) => {
  if (!entryDate) return '';
  const entry = new Date(entryDate);
  if (isNaN(entry.getTime())) return '';
  const entryStr = entry.toISOString().split('T')[0];

  if (!exitDate) return entryStr;
  const exit = new Date(exitDate);
  if (isNaN(exit.getTime())) return entryStr;
  const exitStr = exit.toISOString().split('T')[0];

  if (entryStr === exitStr) return entryStr;
  return `${entryStr} - ${exitStr}`;
};

const formatHour = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

module.exports = async function export_visitors(req, res) {
  try {
    const { period = 'month', from, to, vehicle, title, fields } = req.query;
    const reportTitle = title || 'Visitors Data Report';
    const bounds = getPeriodBounds(period, from, to);

    const userId = String(req.user?.id || req.user?._id || '');
    const userRole = (req.user?.role || '').toLowerCase().trim();

    let match = {};

    if (bounds) {
      match.entry_date = { $gte: bounds.start, $lte: bounds.end };
    }

    if (vehicle && vehicle !== 'all') {
      if (vehicle === 'with_vehicle') {
        match['vehicle_storage.has_vehicle'] = { $eq: true };
      } else if (vehicle === 'without_vehicle') {
        match['vehicle_storage.has_vehicle'] = { $ne: true };
      }
    }

    if (userRole.includes('receptionist')) {
      match['departments_assigned.assigned_by.user_id'] = userId;
    } else if (['head of department', 'department manager', 'department head', 'director'].some((k) => userRole.includes(k))) {
      // HODs export only visitors handled in the department(s) they lead
      const departmentIds = await getDepartmentIdsForHead(req.user?.userId || userId);
      if (!departmentIds.length) {
        return res.status(403).json({ success: false, message: 'No department found for this head of department' });
      }
      match['departments_assigned'] = { $elemMatch: { department_id: { $in: departmentIds } } };
    } else if (userRole.includes('employee') || userRole.includes('staff') || userRole.includes('officer') || userRole.includes('clerk')) {
      match['departments_assigned'] = { $elemMatch: { provider_id: userId } };
    }

    const visitors = await ServiceDelivery.find(match).lean();

    const availableFields = {
      identification: { header: 'Identification', getter: (v) => v.identification?.number || '' },
      identification_type: { header: 'Identification Type', getter: (v) => v.identification?.id_type || '' },
      plate_number: { header: 'Plate Number', getter: (v) => v.vehicle_storage?.has_vehicle ? (v.vehicle_storage?.vehicle_details?.plate_number || '') : '' },
      full_name: { header: 'Full Name', getter: (v) => v.full_name || '' },
      telephone: { header: 'Telephone', getter: (v) => v.telephone || '' },
      email: { header: 'Email', getter: (v) => v.email || '' },
      gender: { header: 'Gender', getter: (v) => v.gender || '' },
      date: { header: 'Date', getter: (v) => formatDateRange(v.entry_date, v.exist_date) },
      from_hour: { header: 'From', getter: (v) => formatHour(v.entry_date) },
      to_hour: { header: 'To', getter: (v) => formatHour(v.exist_date) },
      duration: { header: 'Duration', getter: (v) => formatDuration(v.durations?.entry_and_leave_duration || '') },
      departments_assigned: { header: 'Oriented To', getter: (v) => {
        if (!v.departments_assigned || v.departments_assigned.length === 0) return '';
        return v.departments_assigned.map(d => d.department_name || '').filter(Boolean).join('\n');
      }},
    };

    const selectedFieldKeys = fields ? fields.split(',').filter(f => availableFields[f]) : Object.keys(availableFields);

    const dateGroupFields = ['date', 'from_hour', 'to_hour', 'duration'];
    const otherFields = selectedFieldKeys.filter(f => !dateGroupFields.includes(f));
    const orderedFields = [...otherFields, ...dateGroupFields.filter(f => selectedFieldKeys.includes(f))];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CoK Systems';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Visitors Data');

    sheet.mergeCells('A1:' + String.fromCharCode(64 + orderedFields.length) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { size: 16, color: { argb: 'FF056daa' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    const headerRow = sheet.getRow(2);
    orderedFields.forEach((field, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = availableFields[field]?.header || field;
      cell.font = { bold: true, color: { argb: 'FF056daa' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    });
    headerRow.height = 20;

    visitors.forEach((visitor) => {
      const row = sheet.addRow({});
      orderedFields.forEach((field, index) => {
        const cell = row.getCell(index + 1);
        const getter = availableFields[field]?.getter || (() => '');
        cell.value = getter(visitor);
      });
    });

    orderedFields.forEach((_, index) => {
      const column = sheet.getColumn(index + 1);
      column.alignment = { vertical: 'middle', wrapText: true };
      column.width = 25;
    });

    sheet.columns.forEach(col => {
      let maxLength = 15;
      col.eachCell({ includeEmpty: false }, cell => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLength) maxLength = len;
      });
      if (col.width && col.width < maxLength) col.width = Math.min(maxLength + 2, 50);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error in export_visitors:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while generating the visitors report',
      error: error.message,
    });
  }
};