import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiSearch, FiDownload, FiUsers, FiArrowLeft } from 'react-icons/fi';
import SpiralLoader from '../../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';
const POLL_INTERVAL = 10000; // silently refresh attendance records every 10s
const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

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

export default function AttendeesList({ overlayEventId = null, embedded = false }) {
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const navigate = useNavigate();

  const [attendees, setAttendees] = useState([]);
  const [eventName, setEventName] = useState('');
  const [eventStartedAt, setEventStartedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newCount, setNewCount] = useState(0);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null
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
    if (exporting) return;
    setExporting('excel');
    try {
      await doExportExcel();
    } finally {
      setExporting(null);
    }
  }

  async function doExportExcel() {
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
    if (exporting) return;
    setExporting('pdf');
    try {
      await doExportPdf();
    } finally {
      setExporting(null);
    }
  }

  async function doExportPdf() {
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

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-5xl px-3 sm:px-6 md:px-8 py-6">
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              {eventName || 'Attendance Records'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                {filtered.length} attendee{filtered.length !== 1 ? 's' : ''}
              </p>
              {newCount > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5"
                  style={{ backgroundColor: '#E8F5E9', color: '#2E7D32', fontFamily: fontHeading }}
                >
                  +{newCount} new
                </span>
              )}
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button
                onClick={exportExcel}
                disabled={!!exporting}
                className="cok-btn-primary inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ width: 'auto', padding: '0.6rem 1rem' }}
              >
                {exporting === 'excel' ? (
                  <span>Exporting...</span>
                ) : (
                  <>
                    <FiDownload className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Excel</span>
                    <span className="sm:hidden">Excel</span>
                  </>
                )}
              </button>
              <button
                onClick={exportPdf}
                disabled={!!exporting}
                className="inline-flex items-center gap-1.5 text-white text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: DANGER, fontFamily: fontHeading, border: 0, borderRadius: 0, padding: '0.6rem 1rem' }}
                onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.backgroundColor = '#C0392B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
              >
                {exporting === 'pdf' ? (
                  <span>Exporting...</span>
                ) : (
                  <>
                    <FiDownload className="w-4 h-4" />
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="relative mb-4">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: PRIMARY }} />
          <input
            type="text"
            value={search}
            placeholder="Search by name, institution, position, email..."
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full cok-auth-input pr-3 py-2 text-sm"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <SpiralLoader color={PRIMARY} />
            <span className="ml-3 text-sm" style={{ fontFamily: fontHeading, color: GRAY_DISABLED }}>Loading attendance records...</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-10 text-center bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <FiUsers className="w-8 h-8 mx-auto mb-3" style={{ color: '#CCCCCC' }} />
            <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              {search ? 'No results match your search.' : 'No attendance records yet.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="block overflow-x-auto bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    {['S/N', 'Full Name', 'Email', 'Institution', 'Position', 'Signature', 'Submitted At'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: '#FFFFFF', fontFamily: fontHeading }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a, i) => (
                    <tr
                      key={a._id}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F7F9FB',
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: GRAY_DISABLED }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{a.attendeeFullName}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#555555' }}>{a.attendeeEmail || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#555555' }}>{a.attendeeInstitution || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#555555' }}>{a.attendeePosition || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                          <span style={{ color: '#CCCCCC' }}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: GRAY_DISABLED }}>{formatTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
                <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  Page {page} of {totalPages}, {filtered.length} total
                </span>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="cok-btn-outlined disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    Back
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className="px-3 py-1.5 text-xs cursor-pointer transition-colors"
                      style={{
                        fontFamily: fontHeading,
                        borderRadius: 0,
                        border: `1px solid ${n === page ? PRIMARY : BORDER}`,
                        backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                        color: n === page ? '#FFFFFF' : NEUTRAL_DARK,
                        fontWeight: n === page ? 600 : 400,
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
                    className="cok-btn-outlined disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!embedded && (
        <button
          type="button"
          title="Go back"
          onClick={() => navigate(-1)}
          className="cok-btn-outlined-reverse fixed z-50 flex items-center justify-center cursor-pointer"
          style={{ width: '30px', height: '30px', padding: 0, right: '16px', bottom: '16px' }}
        >
          <FiArrowLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
