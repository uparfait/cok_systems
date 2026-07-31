const ExcelJS = require('exceljs');
const Request = require('../../models/request.js');

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

module.exports = async function export_excel(req, res) {
  try {
    const { period, from, to, fields, title, sender_layout } = req.query;
    const reportTitle = title || 'Incoming Correspondences Report';
    const senderLayout = sender_layout === 'separate' ? 'separate' : 'combined';

    const bounds = getPeriodBoundsLocal(period || 'all', from, to);
    let query = {};
    if (bounds) {
      query.created_at = { $gte: bounds.start, $lte: bounds.end };
    }

    const requests = await Request.find(query).sort({ created_at: -1 }).lean();

    const availableFields = {
      redaction_date: { header: 'Redaction Date', getter: (r) => formatDate(r.redaction_date) },
      reference_number: { header: 'Reference Number', getter: (r) => r.reference_number || '' },
      reception_date: { header: 'Reception Date', getter: (r) => formatDate(r.reception_date) },
      recipient: { header: 'Recipient', getter: (r) => r.recipient || 'COK' },
      subject: { header: 'Subject', getter: (r) => r.subject || '' },
      orientation: { header: 'Orientation', getter: (r) => r.orientation || '' },
      remarks: { header: 'Remarks', getter: (r) => r.remarks || '' }
    };

    let selectedFields = fields ? fields.split(',') : Object.keys(availableFields);

    if (senderLayout === 'separate') {
      if (!selectedFields.includes('sender_name')) selectedFields.push('sender_name');
      if (!selectedFields.includes('sender_email')) selectedFields.push('sender_email');
      if (!selectedFields.includes('sender_telephone')) selectedFields.push('sender_telephone');
    } else {
      if (!selectedFields.includes('sender')) selectedFields.push('sender');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CoK Systems';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Incoming Correspondences');

    sheet.mergeCells('A1:' + String.fromCharCode(64 + selectedFields.length) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { size: 16, color: { argb: 'FF056daa' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    const headerRow = sheet.getRow(2);
    selectedFields.forEach((field, index) => {
      const cell = headerRow.getCell(index + 1);
      if (field === 'sender') {
        cell.value = 'Sender';
      } else if (field === 'sender_name') {
        cell.value = 'Sender Name';
      } else if (field === 'sender_email') {
        cell.value = 'Sender Email';
      } else if (field === 'sender_telephone') {
        cell.value = 'Sender Telephone';
      } else {
        cell.value = availableFields[field]?.header || field;
      }
      cell.font = { bold: true, color: { argb: 'FF34A8DB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 20;

    requests.forEach((reqItem) => {
      const row = sheet.addRow({});
      selectedFields.forEach((field, index) => {
        const cell = row.getCell(index + 1);
        if (field === 'sender') {
          cell.value = [reqItem.sender?.name, reqItem.sender?.email, reqItem.sender?.telephone].filter(Boolean).join(', ') || '';
        } else if (field === 'sender_name') {
          cell.value = reqItem.sender?.name || '';
        } else if (field === 'sender_email') {
          cell.value = reqItem.sender?.email || '';
        } else if (field === 'sender_telephone') {
          cell.value = reqItem.sender?.telephone || '';
        } else {
          const getter = availableFields[field]?.getter || (() => '');
          cell.value = getter(reqItem);
        }
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
    console.error('Error in export_excel:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while generating the report'
    });
  }
};
