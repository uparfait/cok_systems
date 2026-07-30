const fs = require('fs');
const path = require('path');
const Attendance = require('../models/Attendance');
const LiveEvent = require('../models/LiveEvent');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'LOGO_COK_report.png');
const LOGO_RATIO = 221 / 1116; // original logo image is 1116x221 px

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

class ExportAttendanceController {
  static async handle(req, res) {
    try {
      const { eventSpecialId, type = 'excel' } = req.query;

      if (!eventSpecialId) {
        return res.status(400).json({ success: false, message: 'eventSpecialId is required' });
      }

      const attendees = await Attendance.find({ eventSpecialId })
        .sort({ attendanceTime: 1 })
        .lean();

      if (!attendees || attendees.length === 0) {
        return res.status(404).json({ success: false, message: 'No attendance records found' });
      }

      // Resolve a human-readable event name: query param first, then the live event record
      const liveEvent = await LiveEvent.findOne({ eventSpecialId }).lean().catch(() => null);
      let eventName = (req.query.eventName || '').trim();
      if (!eventName || eventName === 'undefined' || eventName === 'null') {
        eventName = liveEvent?.eventName || attendees[0]?.eventName || eventSpecialId;
      }
      const safeName = eventName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_') || 'attendance';
      const hasLogo = fs.existsSync(LOGO_PATH);
      const heldAt = formatDateTime(liveEvent?.startedAt || attendees[0]?.attendanceTime || attendees[0]?.createdAt);
      const footerNote = `Total Attendees: ${attendees.length}   Exported: ${formatDateTime(new Date().toISOString())}`;

      if (type === 'excel') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Attendance');

        ws.columns = [
          { width: 6 }, { width: 30 }, { width: 32 }, { width: 18 },
          { width: 28 }, { width: 24 }, { width: 12 }, { width: 20 },
        ];

        // Logo header floats over the first rows, sized to span the table width
        let rowCursor = 1;
        if (hasLogo) {
          const imgId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
          const logoWidth = 820;
          ws.addImage(imgId, {
            tl: { col: 0, row: 0 },
            ext: { width: logoWidth, height: Math.round(logoWidth * LOGO_RATIO) },
          });
          rowCursor = 10; // leave empty rows behind the floating image
        }

        const titleRow = ws.getRow(rowCursor);
        titleRow.getCell(1).value = eventName;
        titleRow.getCell(1).font = { bold: true, size: 14 };
        rowCursor += 1;

        const metaRow = ws.getRow(rowCursor);
        metaRow.getCell(1).value = `Meeting held at: ${heldAt}`;
        metaRow.getCell(1).font = { size: 10, color: { argb: 'FF666666' } };
        rowCursor += 2;

        const headerRow = ws.getRow(rowCursor);
        const headers = ['S/N', 'Full Name', 'Email', 'Phone', 'Institution', 'Position', 'Signed', 'Submitted At'];
        headers.forEach((h, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1255E5' } };
        });
        rowCursor += 1;

        attendees.forEach((a, i) => {
          const row = ws.getRow(rowCursor + i);
          const values = [
            i + 1,
            a.attendeeFullName || '',
            a.attendeeEmail || '',
            a.attendeePhoneNumber || '',
            a.attendeeInstitution || '',
            a.attendeePosition || '',
            a.attendeeSignature ? 'Yes' : 'No',
            formatDateTime(a.createdAt),
          ];
          values.forEach((v, j) => { row.getCell(j + 1).value = v; });
        });

        // Footer note below the table
        const footerRow = ws.getRow(rowCursor + attendees.length + 1);
        footerRow.getCell(1).value = footerNote;
        footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.xlsx"`);
        await wb.xlsx.write(res);
        return res.end();
      }

      if (type === 'pdf') {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 30, bottom: 30, left: 30, right: 30 },
          info: { Title: `${eventName} - Attendees` },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.pdf"`);
        doc.pipe(res);

        const startX = 30;
        const contentWidth = 535; // A4 width (595) minus margins
        let currentY = 30;

        // Full-width logo header
        if (hasLogo) {
          doc.image(LOGO_PATH, startX, currentY, { width: contentWidth });
          currentY += contentWidth * LOGO_RATIO + 14;
        }

        // Title
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
          .text(eventName, startX, currentY, { width: contentWidth });
        currentY = doc.y + 4;
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
          .text(`Meeting held at: ${heldAt}`, startX, currentY);
        currentY = doc.y + 10;

        // Table
        const columns = [
          { header: 'S/N', width: 25 },
          { header: 'Full Name', width: 85 },
          { header: 'Email', width: 90 },
          { header: 'Phone', width: 60 },
          { header: 'Institution', width: 70 },
          { header: 'Position', width: 55 },
          { header: 'Signature', width: 75 },
          { header: 'Submitted At', width: 75 },
        ];
        const ROW_HEIGHT = 30; // tall enough to fit signature images

        const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

        const drawHeader = () => {
          doc.fontSize(8).font('Helvetica-Bold');
          doc.rect(startX, currentY, tableWidth, 16).fill('#1255e5');
          doc.fillColor('#ffffff');
          let x = startX;
          for (const col of columns) {
            doc.text(col.header, x + 3, currentY + 4, { width: col.width - 6, align: 'left' });
            x += col.width;
          }
          currentY += 16;
          doc.fontSize(7).font('Helvetica');
        };

        drawHeader();

        for (let i = 0; i < attendees.length; i++) {
          const a = attendees[i];
          const rowData = [
            String(i + 1),
            a.attendeeFullName || '',
            a.attendeeEmail || '',
            a.attendeePhoneNumber || '',
            a.attendeeInstitution || '',
            a.attendeePosition || '',
            null, // signature column, drawn as an image below
            formatDateTime(a.createdAt),
          ];

          // Check if we need a new page
          if (currentY + ROW_HEIGHT > 770) {
            doc.addPage();
            currentY = 40;
            drawHeader();
          }

          // Row background
          if (i % 2 === 1) {
            doc.rect(startX, currentY, tableWidth, ROW_HEIGHT).fill('#f3f4f6');
          }

          // Row data
          doc.fillColor('#000000');
          let xOffset = startX;
          for (let j = 0; j < columns.length; j++) {
            if (rowData[j] === null) {
              // Signature cell: embed the drawn signature image, preserving aspect ratio
              if (a.attendeeSignature && a.attendeeSignature.startsWith('data:image')) {
                try {
                  const base64 = a.attendeeSignature.split(',')[1];
                  const imgBuffer = Buffer.from(base64, 'base64');
                  doc.image(imgBuffer, xOffset + 3, currentY + 3, {
                    fit: [columns[j].width - 6, ROW_HEIGHT - 6],
                  });
                } catch (e) {
                  doc.text('—', xOffset + 2, currentY + 4, { width: columns[j].width - 4, align: 'left' });
                }
              } else {
                doc.text('—', xOffset + 2, currentY + 4, { width: columns[j].width - 4, align: 'left' });
              }
            } else {
              doc.text(rowData[j], xOffset + 2, currentY + 4, { width: columns[j].width - 4, align: 'left' });
            }
            xOffset += columns[j].width;
          }

          // Row border
          doc.rect(startX, currentY, tableWidth, ROW_HEIGHT).lineWidth(0.3).strokeColor('#e5e7eb').stroke();

          currentY += ROW_HEIGHT;
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#888888');
        doc.text(footerNote, startX, 778, { width: tableWidth, align: 'left' });
        doc.fillColor('#9ca3af');
        doc.text(`City of Kigali - Event Management System`, startX, 790, { width: tableWidth, align: 'center' });

        doc.end();
        return;
      }

      return res.status(400).json({ success: false, message: 'Invalid export type. Use "excel" or "pdf".' });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error exporting attendance records',
        error: error.message,
      });
    }
  }
}

module.exports = ExportAttendanceController;
