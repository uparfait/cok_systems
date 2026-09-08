import React, { useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { FiDownload, FiLoader, FiX } from 'react-icons/fi';
import { smartParkingService } from '../../../core/services/adminService';
import { useToast } from '../../../core/contexts/ToastContext';

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const SUCCESS = '#4CAF50';
const SUCCESS_HOVER = '#388E3C';
const fontHeading = "'Montserrat', sans-serif";

interface ParkingExportDialogProps {
  show: boolean;
  onClose: () => void;
}

interface ExportRecord {
  plate_number?: string;
  driver_name?: string;
  driver_type?: string;
  status?: string;
  check_in?: string;
}

const ParkingExportDialog: React.FC<ParkingExportDialogProps> = ({ show, onClose }) => {
  const { showError } = useToast();
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const formatDateForPDF = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const truncateText = (t: string | undefined, m: number) => t ? (t.length > m ? t.substring(0, m - 3) + '...' : t) : 'N/A';

  const fetchExportRecords = useCallback(async (opts?: { from?: string; to?: string }): Promise<ExportRecord[]> => {
    const r = await smartParkingService.getAllPaginated(1, 1000, 'all', { from: opts?.from, to: opts?.to });
    return Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
  }, []);

  const loadReportBanner = async (): Promise<string | null> => {
    try {
      const res = await fetch('/LOGO_COK_report.png');
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const rangeOpts = () => (exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined);

  const handleDownloadReport = useCallback(async () => {
    setExporting(true);
    try {
      const opts = rangeOpts();
      const records = await fetchExportRecords(opts);
      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      let y = 10;
      const banner = await loadReportBanner();
      if (banner) {
        try {
          const logoW = pw - 20;
          const logoH = logoW * (221 / 1116);
          doc.addImage(banner, 'PNG', 10, y, logoW, logoH);
          y += logoH + 10;
        } catch { /* render without the banner if it fails to load */ }
      }
      doc.setFont('helvetica', 'bold');
      const now = new Date();
      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(formatDateForPDF(now), pw / 2, y, { align: 'center' }); y += 5;
      doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 10;
      doc.setFontSize(16); doc.setTextColor(5, 109, 170);
      const t = 'RECENT PARKING RECORDS'; doc.text(t, pw / 2, y, { align: 'center' });
      doc.setDrawColor(5, 109, 170); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 8;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      const scope = opts?.from || opts?.to
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} records)`
        : `All records (${records.length})`;
      doc.text(scope, pw / 2, y, { align: 'center' }); y += 10;

      if (records.length > 0) {
        const rows = records.map(rec => [
          truncateText(rec.plate_number || 'N/A', 12),
          truncateText(rec.driver_name || 'N/A', 24),
          truncateText(rec.driver_type || 'N/A', 12),
          rec.status === 'active' ? 'Active' : rec.status === 'completed' ? 'Completed' : 'N/A',
          rec.check_in ? new Date(rec.check_in).toLocaleString() : 'N/A',
        ]);
        autoTable(doc, {
          startY: y,
          head: [['Plate', 'Driver', 'Type', 'Status', 'Time']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [5, 109, 170], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 75, halign: 'left' }, 2: { cellWidth: 45 }, 3: { cellWidth: 40 }, 4: { cellWidth: 80 } },
          margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 },
          tableWidth: 280,
          didDrawPage: (data) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(10, ph - 15, pw - 10, ph - 15); doc.setFontSize(7); doc.setTextColor(128, 128, 128); doc.text('City of Kigali - Smart Parking Management System', pw / 2, ph - 12, { align: 'center' }); doc.text(`Page ${data.pageNumber}`, pw - 10, ph - 12, { align: 'right' }); },
        });
      } else {
        doc.setFontSize(11); doc.setTextColor(100, 100, 100);
        doc.text('No parking records found for this period', pw / 2, y + 30, { align: 'center' });
      }
      doc.save(`Parking_Records_${now.toISOString().split('T')[0]}.pdf`);
      onClose();
    } catch {
      showError('Failed to export parking records');
    } finally {
      setExporting(false);
    }
  }, [exportMode, exportFrom, exportTo, fetchExportRecords, onClose, showError]);

  const handleDownloadExcel = useCallback(async () => {
    setExporting(true);
    try {
      const opts = rangeOpts();
      const records = await fetchExportRecords(opts);
      const now = new Date();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Parking Records');
      ws.columns = [{ width: 6 }, { width: 18 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 24 }];

      let rowCursor = 1;
      const banner = await loadReportBanner();
      if (banner) {
        const imgId = wb.addImage({ base64: banner, extension: 'png' });
        const logoWidth = 660;
        const logoHeight = logoWidth * (221 / 1116);
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: logoWidth, height: logoHeight } });
        rowCursor = Math.ceil(logoHeight / 15) + 2;
      }

      const titleRow = ws.getRow(rowCursor);
      titleRow.getCell(1).value = 'RECENT PARKING RECORDS';
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF056DAA' } };
      rowCursor += 1;

      const scopeRow = ws.getRow(rowCursor);
      scopeRow.getCell(1).value = opts?.from || opts?.to
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} records)`
        : `All records (${records.length})`;
      scopeRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
      rowCursor += 2;

      const headers = ['S/N', 'Plate', 'Driver', 'Type', 'Status', 'Check-in Time'];
      const headerRow = ws.getRow(rowCursor);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF056DAA' } };
      });
      rowCursor += 1;

      records.forEach((rec, i) => {
        const row = ws.getRow(rowCursor + i);
        [
          i + 1,
          rec.plate_number || 'N/A',
          rec.driver_name || 'N/A',
          rec.driver_type || 'N/A',
          rec.status === 'active' ? 'Active' : rec.status === 'completed' ? 'Completed' : 'N/A',
          rec.check_in ? new Date(rec.check_in).toLocaleString() : 'N/A',
        ].forEach((v, j) => { row.getCell(j + 1).value = v; });
      });

      const footerRow = ws.getRow(rowCursor + records.length + 1);
      footerRow.getCell(1).value =
        `City of Kigali - Smart Parking Management System   Exported: ${now.toLocaleString()}`;
      footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Parking_Records_${now.toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch {
      showError('Failed to export parking records');
    } finally {
      setExporting(false);
    }
  }, [exportMode, exportFrom, exportTo, fetchExportRecords, onClose, showError]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(51,51,51,0.5)' }} onClick={() => !exporting && onClose()}>
      <div className="bg-white w-full max-w-md border border-gray-200 shadow-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export parking records">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-[#333333]">Export Parking Records</h3>
          <button onClick={onClose} disabled={exporting} className="w-7 h-7 flex items-center justify-center border border-gray-200 hover:bg-[#F7F9FB] cursor-pointer"><FiX className="w-4 h-4 text-[#555555]" /></button>
        </div>
        <div className="p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#333333]">
            <input type="radio" name="gate-export-mode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} />
            All records
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#333333]">
            <input type="radio" name="gate-export-mode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} />
            Custom date range (check-in date)
          </label>
          {exportMode === 'range' && (
            <div className="flex flex-wrap items-center gap-3 pl-6">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#555555]" htmlFor="gate-export-from">From</label>
                <input id="gate-export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="cok-auth-input h-8 pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#555555]" htmlFor="gate-export-to">To</label>
                <input id="gate-export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="cok-auth-input h-8 pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button onClick={onClose} disabled={exporting} className="px-4 py-2 text-xs font-medium bg-white border border-[#056daa] text-[#056daa] hover:bg-[rgba(5,109,170,0.06)] cursor-pointer disabled:opacity-50">Cancel</button>
          <button
            onClick={handleDownloadExcel}
            disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
            className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: SUCCESS, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
          >
            {exporting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={handleDownloadReport}
            disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
            className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            {exporting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingExportDialog;
