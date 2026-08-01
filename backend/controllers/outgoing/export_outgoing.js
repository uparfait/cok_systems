const ExcelJS = require('exceljs');
const Outgoing = require('../../models/outgoing.js');

const getPeriodBoundsLocal = (period, from, to) => {
  const now = new Date();
  const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
  const endOfDay = (d) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };

  if (period === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (period === 'week') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23,59,59,999);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23,59,59,999);
    return { start, end };
  }
  if (period === 'range' && from) {
    const start = startOfDay(from);
    const end = to ? endOfDay(to) : endOfDay(now);
    return { start, end };
  }
  return null;
};

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

module.exports = async function export_outgoing(req, res) {
  try {
    const { period, from, to, title, prepared_by } = req.query;
    const reportTitle = title || 'Outgoing Correspondences Report';

    const bounds = getPeriodBoundsLocal(period || 'all', from, to);
    let query = {};
    if (bounds) {
      query.date_of_recording = { $gte: bounds.start, $lte: bounds.end };
    }

    const outgoings = await Outgoing.find(query).sort({ date_of_recording: -1 }).lean();

    const availableFields = {
      reference_number: { header: 'Reference Number', getter: (o) => o.reference_number || '' },
      department_number: { header: 'Department Number', getter: (o) => o.department_number || '' },
      date_of_reception: { header: 'Date of Reception', getter: (o) => formatDate(o.date_of_reception) },
      date_of_recording: { header: 'Date of Recording', getter: (o) => formatDate(o.date_of_recording) },
      destination: { header: 'Destination', getter: (o) => o.destination || '' },
      subject: { header: 'Subject', getter: (o) => o.subject || '' },
      sign_by: { header: 'Sign By', getter: (o) => o.sign_by || '' }
    };

    const selectedFields = Object.keys(availableFields);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IKAZE';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Outgoing Correspondences');

    sheet.mergeCells('A1:' + String.fromCharCode(64 + selectedFields.length) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { size: 16, color: { argb: 'FFE65100' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    const headerRow = sheet.getRow(2);
    selectedFields.forEach((field, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = availableFields[field]?.header || field;
      cell.font = { bold: true, color: { argb: 'FFE65100' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 20;

    outgoings.forEach((outgoingItem) => {
      const row = sheet.addRow({});
      selectedFields.forEach((field, index) => {
        const cell = row.getCell(index + 1);
        const getter = availableFields[field]?.getter || (() => '');
        cell.value = getter(outgoingItem);
      });
    });

    selectedFields.forEach((_, index) => {
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
    console.error('Error in export_outgoing:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while generating the report'
    });
  }
};
