const Attendance = require('../models/Attendance');
const PDFDocument = require('pdfkit');

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

      const eventName = attendees[0]?.eventName || eventSpecialId;
      const safeName = eventName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');

      if (type === 'excel') {
        const headers = ['S/N', 'Full Name', 'Email', 'Phone', 'Institution', 'Position', 'Submitted At'];
        const rows = attendees.map((a, i) => [
          i + 1,
          a.attendeeFullName || '',
          a.attendeeEmail || '',
          a.attendeePhoneNumber || '',
          a.attendeeInstitution || '',
          a.attendeePosition || '',
          formatDateTime(a.createdAt),
        ]);

        let csv = '\uFEFF';
        // Title row
        csv += `${eventName}\n`;
        csv += `Total Attendees: ${attendees.length}\n\n`;
        // Headers
        csv += headers.join(',') + '\n';
        // Data rows - only quote values that contain commas, newlines or quotes
        for (const row of rows) {
          const escaped = row.map(cell => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          csv += escaped.join(',') + '\n';
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.csv"`);
        return res.send(csv);
      }

      if (type === 'pdf') {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 40, bottom: 30, left: 30, right: 30 },
          info: { Title: `${eventName} - Attendees` },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.pdf"`);
        doc.pipe(res);

        // Title
        doc.fontSize(16).font('Helvetica-Bold').text(eventName, { align: 'left' });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica')
          .text(`Total Attendees: ${attendees.length}`, { align: 'left' })
          .text(`Exported: ${formatDateTime(new Date().toISOString())}`, { align: 'left' });
        doc.moveDown(0.5);

        // Table
        const columns = [
          { header: 'S/N', width: 30 },
          { header: 'Full Name', width: 110 },
          { header: 'Email', width: 90 },
          { header: 'Phone', width: 80 },
          { header: 'Institution', width: 80 },
          { header: 'Position', width: 70 },
          { header: 'Submitted At', width: 90 },
        ];

        const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
        const startX = 30;
        let currentY = doc.y;

        // Draw header
        doc.fontSize(8).font('Helvetica-Bold');
        doc.rect(startX, currentY, tableWidth, 16).fill('#1255e5');
        doc.fill('#ffffff');
        let xOffset = startX;
        for (const col of columns) {
          doc.text(col.header, xOffset + 3, currentY + 4, { width: col.width - 6, align: 'left' });
          xOffset += col.width;
        }
        currentY += 16;

        // Draw rows
        doc.fontSize(7).font('Helvetica');
        for (let i = 0; i < attendees.length; i++) {
          const a = attendees[i];
          const rowData = [
            String(i + 1),
            a.attendeeFullName || '',
            a.attendeeEmail || '',
            a.attendeePhoneNumber || '',
            a.attendeeInstitution || '',
            a.attendeePosition || '',
            formatDateTime(a.createdAt),
          ];

          // Check if we need a new page
          if (currentY + 16 > 770) {
            doc.addPage();
            currentY = 40;

            // Redraw header on new page
            doc.fontSize(8).font('Helvetica-Bold');
            doc.rect(startX, currentY, tableWidth, 16).fill('#1255e5');
            doc.fill('#ffffff');
            xOffset = startX;
            for (const col of columns) {
              doc.text(col.header, xOffset + 3, currentY + 4, { width: col.width - 6, align: 'left' });
              xOffset += col.width;
            }
            currentY += 16;
            doc.fontSize(7).font('Helvetica');
          }

          // Row background
          if (i % 2 === 1) {
            doc.rect(startX, currentY, tableWidth, 14).fill('#f3f4f6');
          }

          // Row data
          doc.fill('#000000');
          xOffset = startX;
          for (let j = 0; j < columns.length; j++) {
            doc.text(rowData[j], xOffset + 2, currentY + 3, { width: columns[j].width - 4, align: 'left' });
            xOffset += columns[j].width;
          }

          // Row border
          doc.rect(startX, currentY, tableWidth, 14).lineWidth(0.3).strokeColor('#e5e7eb').stroke();

          currentY += 14;
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#9ca3af');
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