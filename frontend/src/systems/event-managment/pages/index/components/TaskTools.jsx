import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiAlertCircle, FiUsers, FiDownload, FiEdit3 } from 'react-icons/fi';
import { PRIMARY } from './TaskDesignTokens';
import * as XLSX from 'xlsx';

const BASE_URL = '/cok/api/v1';

function detectTaskTools(task) {
  const text = `${task.title || ''} ${task.actionDescription || ''}`.toLowerCase();
  return {
    attendance: /attend/.test(text),
    minutes: /minute/.test(text),
  };
}

export default function TaskTools({ task }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState('');
  const tools = detectTaskTools(task);

  if (!tools.attendance && !tools.minutes) return null;

  async function exportAttendance() {
    setExporting(true);
    setExportErr('');
    try {
      const res = await axios.get(`${BASE_URL}/attendance`, {
        params: { eventSpecialId: task.eventSpecialId, limit: 500 },
      });
      const list = res.data?.data || [];
      if (list.length === 0) {
        setExportErr('No attendance records yet for this event.');
        return;
      }
      const rows = list.map((a, i) => ({
        'S/N': i + 1,
        'Full Name': a.attendeeFullName || '',
        'Institution': a.attendeeInstitution || '',
        'Position': a.attendeePosition || '',
        'Signed': (a.attendeeSignature || a.digitalCertificate) ? 'Yes' : 'No',
        'Submitted At': new Date(a.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 28 }, { wch: 25 }, { wch: 8 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-${(task.title || 'task').replace(/[^\w\- ]+/g, '')}.xlsx`);
    } catch {
      setExportErr('Failed to load attendance records.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: `1px solid #E0E0E0`, borderRadius: 0, padding: '20px', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: '10px', fontWeight: 600, color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontFamily: "'Montserrat', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        Task Tools
      </p>
      <p style={{ fontSize: '12px', color: '#9E9E9E', marginBottom: '16px' }}>Shortcuts for carrying out this responsibility</p>

      {exportErr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFF8E1', border: `1px solid #FFCC80`, color: '#E65100', fontSize: '13px', borderRadius: 0, padding: '10px 12px', marginBottom: '12px' }}>
          <FiAlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />{exportErr}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {tools.attendance && (
          <>
            <button
              onClick={() => navigate(`/event/${task.eventSpecialId}/attendees`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: PRIMARY, color: '#FFFFFF', fontSize: '13px', fontWeight: 600, borderRadius: 0, border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_DARK; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              <FiUsers style={{ width: '16px', height: '16px' }} /> View Attendance
            </button>
            <button
              onClick={exportAttendance}
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, borderRadius: 0, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, transition: 'background-color 0.2s', fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.backgroundColor = '#065F46'; }}
              onMouseLeave={(e) => { if (!exporting) e.currentTarget.style.backgroundColor = '#10B981'; }}
            >
              <FiDownload style={{ width: '16px', height: '16px' }} />
              {exporting ? 'Exporting…' : 'Export Attendance (Excel)'}
            </button>
          </>
        )}
        {tools.minutes && (
          <button
            onClick={() => navigate(`/event/${task.eventSpecialId}/editor`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#4F46E5', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, borderRadius: 0, border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3730A3'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4F46E5'; }}
          >
            <FiEdit3 style={{ width: '16px', height: '16px' }} /> Record Minutes
          </button>
        )}
      </div>
    </div>
  );
}
