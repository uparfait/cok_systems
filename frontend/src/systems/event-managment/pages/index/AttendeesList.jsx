import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SpiralLoader from '../../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';
const POLL_INTERVAL = 5000;
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#248fc2';

const LOGO_URL = '/LOGO_COK_report.png';
const LOGO_RATIO = 221 / 1116; // original logo image is 1116x221 px

// Load the report logo once as a base64 data URL (null if unavailable)
async function loadLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Drawn signatures live in attendeeSignature (base64); uploaded ones are stored
// in digitalCertificate as a served file URL — display whichever exists
const IMAGE_FILE_REGEX = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

function signatureImageSrc(a) {
  if (a?.attendeeSignature) return a.attendeeSignature;
  if (a?.digitalCertificate && IMAGE_FILE_REGEX.test(a.digitalCertificate)) return a.digitalCertificate;
  return null;
}

function hasSignature(a) {
  return !!(a?.attendeeSignature || a?.digitalCertificate);
}

// Fetch an uploaded signature file as a data URL so exports can embed it
async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function AttendeesList() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [attendees, setAttendees] = useState([]);
  const [eventName, setEventName] = useState('');
  const [eventStartedAt, setEventStartedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newCount, setNewCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const prevIdsRef = useRef(new Set());
  const eventSpecialIdRef = useRef(eventSpecialId);
  eventSpecialIdRef.current = eventSpecialId;

  function fetchAttendees(isInitial = false) {
    return axios
      .get(`${BASE_URL}/attendance`, {
        params: { eventSpecialId: eventSpecialIdRef.current, limit: 200, _t: Date.now() },
      })
      .then((res) => {
        const data = res.data?.data || [];
        if (!isInitial) {
          const incoming = data.filter((a) => !prevIdsRef.current.has(a._id));
          if (incoming.length > 0) setNewCount((c) => c + incoming.length);
        }
        prevIdsRef.current = new Set(data.map((a) => a._id));
        setAttendees(data);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!eventSpecialId) return;
    setLoading(true);
    prevIdsRef.current = new Set();

    Promise.all([
      fetchAttendees(true),
      axios.get(`${BASE_URL}/live-events`, { params: { eventSpecialId } }).catch(() => null),
    ]).then(([, evRes]) => {
      const ev = evRes?.data?.data?.[0];
      setEventName(ev?.eventName || '');
      setEventStartedAt(ev?.startedAt || null);
    }).catch(() => setError('Failed to load attendance records.'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => fetchAttendees(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [eventSpecialId]);

  const filtered = attendees.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.attendeeFullName?.toLowerCase().includes(q) ||
      a.attendeeInstitution?.toLowerCase().includes(q) ||
      a.attendeePosition?.toLowerCase().includes(q) ||
      a.attendeeEmail?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function exportExcel() {
    const title = eventName || 'Attendance Report';
    const logo = await loadLogoDataUrl();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance');
    ws.columns = [
      { width: 6 }, { width: 30 }, { width: 32 }, { width: 28 },
      { width: 24 }, { width: 12 }, { width: 20 },
    ];

    // Logo header floats over the first rows, sized to span the table width
    let rowCursor = 1;
    if (logo) {
      const imgId = wb.addImage({ base64: logo, extension: 'png' });
      const logoWidth = 780;
      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: logoWidth, height: Math.round(logoWidth * LOGO_RATIO) },
      });
      rowCursor = 10; // leave empty rows behind the floating image
    }

    ws.getRow(rowCursor).getCell(1).value = title;
    ws.getRow(rowCursor).getCell(1).font = { bold: true, size: 14 };
    rowCursor += 1;
    ws.getRow(rowCursor).getCell(1).value =
      `Meeting held at: ${formatTime(eventStartedAt || attendees[0]?.createdAt)}`;
    ws.getRow(rowCursor).getCell(1).font = { size: 10, color: { argb: 'FF666666' } };
    rowCursor += 2;

    const headers = ['S/N', 'Full Name', 'Email', 'Institution', 'Position', 'Signed', 'Submitted At'];
    const headerRow = ws.getRow(rowCursor);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF056DAA' } };
    });
    rowCursor += 1;

    filtered.forEach((a, i) => {
      const row = ws.getRow(rowCursor + i);
      [
        i + 1,
        a.attendeeFullName || '',
        a.attendeeEmail || '',
        a.attendeeInstitution || '',
        a.attendeePosition || '',
        hasSignature(a) ? 'Yes' : 'No',
        formatTime(a.createdAt),
      ].forEach((v, j) => { row.getCell(j + 1).value = v; });
    });

    // Footer note below the table
    const footerRow = ws.getRow(rowCursor + filtered.length + 1);
    footerRow.getCell(1).value =
      `Total: ${filtered.length} attendee(s)   Exported: ${new Date().toLocaleString()}`;
    footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, `attendance-${title}.xlsx`);
  }

  async function exportPdf() {
    const title = eventName || 'Attendance Report';
    const logo = await loadLogoDataUrl();
    // Resolve every signature to a data URL up front: drawn ones already are,
    // uploaded image files are fetched so jsPDF can embed them synchronously
    const sigDataUrls = await Promise.all(
      filtered.map(async (a) => {
        if (a.attendeeSignature) return a.attendeeSignature;
        const src = signatureImageSrc(a);
        return src ? await toDataUrl(src) : null;
      })
    );
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = 30;

    // Full-width logo header
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', margin, y, contentWidth, contentWidth * LOGO_RATIO);
        y += contentWidth * LOGO_RATIO + 20;
      } catch { /* render without logo if the image fails */ }
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Meeting held at: ${formatTime(eventStartedAt || attendees[0]?.createdAt)}`, margin, y);
    doc.setTextColor(0);
    y += 10;

    const pageHeight = doc.internal.pageSize.getHeight();
    const footerNote = `Total: ${filtered.length} attendee(s)   Exported: ${new Date().toLocaleString()}`;

    autoTable(doc, {
      startY: y,
      head: [['S/N', 'Full Name', 'Email', 'Institution', 'Position', 'Signature', 'Submitted At']],
      body: filtered.map((a, i) => [
        i + 1,
        a.attendeeFullName || '',
        a.attendeeEmail || '',
        a.attendeeInstitution || '',
        a.attendeePosition || '',
        '', // drawn as an image in didDrawCell
        formatTime(a.createdAt),
      ]),
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: [5, 109, 170], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      columnStyles: { 0: { cellWidth: 30 }, 5: { cellWidth: 90 } },
      bodyStyles: { minCellHeight: 30 },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 5) return;
        const sig = sigDataUrls[data.row.index];
        if (!sig) return;
        try {
          // Fit inside the cell while preserving the signature's aspect ratio
          const props = doc.getImageProperties(sig);
          const maxW = data.cell.width - 8;
          const maxH = data.cell.height - 6;
          const scale = Math.min(maxW / props.width, maxH / props.height);
          const w = props.width * scale;
          const h = props.height * scale;
          const x = data.cell.x + (data.cell.width - w) / 2;
          const cy = data.cell.y + (data.cell.height - h) / 2;
          const fmt = /^data:image\/jpe?g/i.test(sig) ? 'JPEG' : 'PNG';
          doc.addImage(sig, fmt, x, cy, w, h);
        } catch { /* skip unreadable signature images */ }
      },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(136);
        doc.text(footerNote, margin, pageHeight - 16);
        doc.setTextColor(0);
      },
    });

    doc.save(`attendance-${title}.pdf`);
  }

  const searchFocused = typeof window !== 'undefined' ? false : false;

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Go Back
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {eventName || 'Attendance Records'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {filtered.length} attendee{filtered.length !== 1 ? 's' : ''}
                </p>
                {newCount > 0 && (
                  <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-none">
                    +{newCount} new
                  </span>
                )}
              </div>
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={exportExcel}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
                style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Excel</span>
              </button>
              <button
                onClick={exportPdf}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
                style={{ backgroundColor: '#C62828', fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E53935'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#C62828'; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            value={search}
            placeholder="Search by name, institution, position, email..."
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.2px',
              lineHeight: '1.4',
              color: '#333333',
              backgroundColor: '#F7F9FB',
              borderRadius: 0,
              border: '1px solid transparent',
              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = PRIMARY;
              e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          />
        </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <SpiralLoader color="#056daa" />
          <span className="ml-2 text-sm" style={{ fontFamily: "'Montserrat', sans-serif", color: '#888888' }}>Loading attendance records…</span>
        </div>
      )}

        {!loading && error && (
          <div className="p-4 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-8 text-center" style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0' }}>
            <svg className="w-8 h-8 mx-auto mb-2" style={{ color: '#CCCCCC' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            <p className="text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>
              {search ? 'No results match your search.' : 'No attendance records yet.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="block overflow-x-auto rounded-none">
              <table className="w-full text-sm rounded-none">
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>S/N</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Institution</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Signature</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a, i) => (
                    <tr key={a._id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888888' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeeFullName}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeeEmail || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeeInstitution || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeePosition || '—'}</td>
                      <td className="px-4 py-3">
                        {signatureImageSrc(a) ? (
                          <img
                            src={signatureImageSrc(a)}
                            alt={`Signature of ${a.attendeeFullName}`}
                            className="h-8 max-w-[110px] object-contain"
                          />
                        ) : a.digitalCertificate ? (
                          <a
                            href={a.digitalCertificate}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                            style={{ color: PRIMARY }}
                          >
                            View file
                          </a>
                        ) : (
                          <span style={{ color: '#CCCCCC' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#888888' }}>{formatTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
                <span className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-none"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`px-3 py-1.5 text-xs border transition-colors rounded-none ${
                        n === page
                          ? 'text-white font-semibold'
                          : 'border-gray-300 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                        borderColor: n === page ? PRIMARY : '#E0E0E0',
                      }}
                      onMouseEnter={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                      onMouseLeave={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-none"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
