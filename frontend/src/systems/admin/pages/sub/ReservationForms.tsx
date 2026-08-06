import React from 'react';
import { FiUser, FiTruck, FiClock, FiPhone, FiLoader, FiCheck, FiDownload, FiUpload, FiX, FiMapPin, FiBriefcase, FiFileText } from 'react-icons/fi';

interface ReservationFormData { plate_number: string; driver_name: string; id_type: string; id_number: string; telephone_number: string; slot_number: string; arrival_time?: string; }
interface StaffBookingData { staff_name: string; phone: string; plate_number: string; department_name?: string; owner_title?: string; id_type?: string; identification?: string; }

// City of Kigali (CoK) institutional design constants — same set as the receptionist dashboard
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const ACCENT_DARK_BLUE = '#2980B9';
const TERTIARY = '#CDB896';
const NEUTRAL_LIGHT = '#F7F9FB';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

// CoK form label: Montserrat, tan, strict uppercase (design rule label style)
const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block mb-1 text-[12px] font-semibold uppercase" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>
    {children} {required && <span style={{ color: '#E74C3C' }}>*</span>}
  </label>
);

// CoK input styling: light canvas, square corners, soft shadow, blue glow on focus
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' };
const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.border = `1px solid ${PRIMARY}`; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; };
const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; };

interface VisitorFormProps {
  formData: ReservationFormData; loading: boolean; onChange: (d: ReservationFormData) => void; onSubmit: (e: React.FormEvent) => void; onDownloadTemplate: () => void;
  bulkFile: File | null; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onFileRemove: () => void; onBulkUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const VisitorReservationForm: React.FC<VisitorFormProps> = ({ formData, loading, onChange, onSubmit, onDownloadTemplate, bulkFile, onFileSelect, onFileRemove, onBulkUpload, fileInputRef }) => (
  <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
    <div className="px-5 py-3.5" style={{ backgroundColor: PRIMARY }}>
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-white/15"><FiUser className="w-4 h-4 text-white" /></div>
        <h2 className="text-[14px] font-bold uppercase text-white" style={{ fontFamily: fontHeading, letterSpacing: '1px' }}>Visitor Reservations</h2>
      </div>
    </div>
    <div className="p-5">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label required>Full Name</Label>
            <div className="relative"><FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="driver_name" value={formData.driver_name} onChange={e => onChange({ ...formData, driver_name: e.target.value })} required placeholder="Enter full name" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label required>Plate Number</Label>
            <div className="relative"><FiTruck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAD 302H" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>Arrival Time</Label>
            <div className="relative"><FiClock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="datetime-local" name="arrival_time" value={formData.arrival_time} onChange={e => onChange({ ...formData, arrival_time: e.target.value })} className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>Phone Number</Label>
            <div className="relative"><FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="tel" name="telephone_number" value={formData.telephone_number} onChange={e => onChange({ ...formData, telephone_number: e.target.value })} placeholder="+250 791524754" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>ID Type</Label><select name="id_type" value={formData.id_type} onChange={e => onChange({ ...formData, id_type: e.target.value })} className="w-full px-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="NID">National ID</option><option value="Passport">Passport</option><option value="Driving Permit">Driving Permit</option></select></div>
          <div><Label>ID Number</Label><input type="text" name="id_number" value={formData.id_number} onChange={e => onChange({ ...formData, id_number: e.target.value })} placeholder="Enter ID number" className="w-full px-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 text-white text-[12px] font-semibold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            {loading ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}Reserve Slot
          </button>
          <button
            type="button" onClick={onDownloadTemplate}
            className="px-4 py-2 text-[12px] font-semibold uppercase flex items-center justify-center gap-1.5 transition-colors hover:bg-[rgba(5,109,170,0.08)]"
            style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
          >
            <FiDownload className="w-3.5 h-3.5" />Template
          </button>
        </div>
      </form>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E0E0E0' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Bulk Visitor Upload</span>
          <span className="text-xs text-[#9E9E9E]">Excel (.xlsx, .csv)</span>
        </div>
        <div className="border-2 border-dashed p-4 text-center transition-colors" style={{ borderColor: '#E0E0E0', backgroundColor: NEUTRAL_LIGHT }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="visitor-bulk" />
          <label htmlFor="visitor-bulk" className="cursor-pointer block"><FiUpload className="w-5 h-5 mx-auto mb-1" style={{ color: PRIMARY }} />
            {bulkFile ? <div className="flex items-center justify-center gap-2 text-xs"><span className="text-[#333]">{bulkFile.name}</span><button type="button" onClick={onFileRemove} style={{ color: '#E74C3C' }}><FiX className="w-3.5 h-3.5" /></button></div> : <><div className="text-xs text-[#555555]">Click to upload</div><div className="text-xs text-[#9E9E9E] mt-0.5">.xlsx, .csv</div></>}
          </label>
        </div>
        {bulkFile && (
          <button
            onClick={onBulkUpload} disabled={loading}
            className="mt-2 w-full py-2 text-white text-[12px] font-semibold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            {loading ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiUpload className="w-3.5 h-3.5" />}Upload List
          </button>
        )}
      </div>
    </div>
  </div>
);

interface StaffFormProps {
  formData: StaffBookingData; loading: boolean; onChange: (d: StaffBookingData) => void; onSubmit: (e: React.FormEvent) => void; onDownloadTemplate: () => void;
  bulkFile: File | null; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onFileRemove: () => void; onBulkUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const StaffBookingForm: React.FC<StaffFormProps> = ({ formData, loading, onChange, onSubmit, onDownloadTemplate, bulkFile, onFileSelect, onFileRemove, onBulkUpload, fileInputRef }) => (
  <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
    <div className="px-5 py-3.5" style={{ backgroundColor: ACCENT_DARK_BLUE }}>
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-white/15"><FiBriefcase className="w-4 h-4 text-white" /></div>
        <h2 className="text-[14px] font-bold uppercase text-white" style={{ fontFamily: fontHeading, letterSpacing: '1px' }}>Permanent Staff Booking</h2>
      </div>
    </div>
    <div className="p-5">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label required>Staff Name</Label>
            <div className="relative"><FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="staff_name" value={formData.staff_name} onChange={e => onChange({ ...formData, staff_name: e.target.value })} required placeholder="e.g., Amos" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label required>Plate Number</Label>
            <div className="relative"><FiTruck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAF 100S" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>Phone</Label>
            <div className="relative"><FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="tel" name="phone" value={formData.phone} onChange={e => onChange({ ...formData, phone: e.target.value })} placeholder="+250 791 783 308" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>ID Number</Label>
            <div className="relative"><FiFileText className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="identification" value={formData.identification} onChange={e => onChange({ ...formData, identification: e.target.value })} placeholder="National ID Number" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
          <div><Label>Department</Label>
            <div className="relative"><FiBriefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="department_name" value={formData.department_name} onChange={e => onChange({ ...formData, department_name: e.target.value })} placeholder="e.g., Finance" className="w-full pl-8 pr-2.5 py-2 focus:outline-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 text-white text-[12px] font-semibold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            style={{ fontFamily: fontHeading, backgroundColor: ACCENT_DARK_BLUE, letterSpacing: '1px', borderRadius: 0 }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#21618C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK_BLUE; }}
          >
            {loading ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiMapPin className="w-3.5 h-3.5" />}Allocate Slot
          </button>
          <button
            type="button" onClick={onDownloadTemplate}
            className="px-4 py-2 text-[12px] font-semibold uppercase flex items-center justify-center gap-1.5 transition-colors hover:bg-[rgba(41,128,185,0.08)]"
            style={{ fontFamily: fontHeading, border: `1px solid ${ACCENT_DARK_BLUE}`, color: ACCENT_DARK_BLUE, letterSpacing: '1px', borderRadius: 0 }}
          >
            <FiDownload className="w-3.5 h-3.5" />Template
          </button>
        </div>
      </form>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E0E0E0' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Staff Directory Sync</span>
          <span className="text-xs text-[#9E9E9E]">Upload spreadsheet</span>
        </div>
        <div className="border-2 border-dashed p-4 text-center transition-colors" style={{ borderColor: '#E0E0E0', backgroundColor: NEUTRAL_LIGHT }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="staff-bulk" />
          <label htmlFor="staff-bulk" className="cursor-pointer block"><FiUpload className="w-5 h-5 mx-auto mb-1" style={{ color: ACCENT_DARK_BLUE }} />
            {bulkFile ? <div className="flex items-center justify-center gap-2 text-xs"><span className="text-[#333]">{bulkFile.name}</span><button type="button" onClick={onFileRemove} style={{ color: '#E74C3C' }}><FiX className="w-3.5 h-3.5" /></button></div> : <><div className="text-xs text-[#555555]">Choose file for staff reservation</div><div className="text-xs text-[#9E9E9E] mt-0.5">Excel or CSV format</div></>}
          </label>
        </div>
        {bulkFile && (
          <button
            onClick={onBulkUpload} disabled={loading}
            className="mt-2 w-full py-2 text-white text-[12px] font-semibold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            style={{ fontFamily: fontHeading, backgroundColor: ACCENT_DARK_BLUE, letterSpacing: '1px', borderRadius: 0 }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#21618C'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK_BLUE; }}
          >
            {loading ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiUpload className="w-3.5 h-3.5" />}Upload List
          </button>
        )}
      </div>
    </div>
  </div>
);
