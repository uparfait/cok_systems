const Attendance = require('../models/Attendance');

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
      const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_');

      if (type === 'excel') {
        // Build CSV content
        const headers = ['S/N', 'Full Name', 'Email', 'Phone', 'Institution', 'Position', 'Submitted At'];
        const rows = attendees.map((a, i) => [
          i + 1,
          a.attendeeFullName || '',
          a.attendeeEmail || '',
          a.attendeePhoneNumber || '',
          a.attendeeInstitution || '',
          a.attendeePosition || '',
          a.createdAt ? new Date(a.createdAt).toISOString() : '',
        ]);

        let csv = '\uFEFF'; // BOM for Excel UTF-8
        csv += headers.join(',') + '\n';
        for (const row of rows) {
          const escaped = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`);
          csv += escaped.join(',') + '\n';
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.csv"`);
        return res.send(csv);
      }

      if (type === 'pdf') {
        // Simple HTML-based PDF-like output
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${eventName} - Attendees</title>`;
        html += `<style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #1255e5; color: white; padding: 8px 10px; text-align: left; }
          td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f9f9f9; }
        </style></head><body>`;
        html += `<h1>${eventName}</h1>`;
        html += `<p class="meta">Total Attendees: ${attendees.length} | Exported: ${new Date().toLocaleString()}</p>`;
        html += `<table><thead><tr><th>S/N</th><th>Full Name</th><th>Email</th><th>Phone</th><th>Institution</th><th>Position</th><th>Submitted At</th></tr></thead><tbody>`;
        for (let i = 0; i < attendees.length; i++) {
          const a = attendees[i];
          html += `<tr><td>${i + 1}</td><td>${a.attendeeFullName || ''}</td><td>${a.attendeeEmail || ''}</td><td>${a.attendeePhoneNumber || ''}</td><td>${a.attendeeInstitution || ''}</td><td>${a.attendeePosition || ''}</td><td>${a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</td></tr>`;
        }
        html += '</tbody></table></body></html>';

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}-attendees.html"`);
        return res.send(html);
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