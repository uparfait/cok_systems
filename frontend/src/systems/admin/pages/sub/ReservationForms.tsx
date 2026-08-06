import React from 'react';
import { FiUser, FiTruck, FiClock, FiPhone, FiLoader, FiCheck, FiDownload, FiUpload, FiX, FiMapPin, FiBriefcase, FiFileText, FiCreditCard } from 'react-icons/fi';

interface ReservationFormData { plate_number: string; driver_name: string; id_type: string; id_number: string; telephone_number: string; slot_number: string; arrival_time?: string; }
interface StaffBookingData { staff_name: string; phone: string; plate_number: string; department_name?: string; owner_title?: string; id_type?: string; identification?: string; }

// City of Kigali (CoK) institutional design constants
const PRIMARY = '#056daa';
const ACCENT_DARK_BLUE = '#2980B9';
const NEUTRAL_LIGHT = '#F7F9FB';
const fontHeading = "'Montserrat', sans-serif";

// Login-style field: cok-auth-label above a cok-auth-input with the icon inside on the left
const Field: React.FC<{ label: string; required?: boolean; icon: React.ReactNode; children: React.ReactNode }> = ({ label, required, icon, children }) => (
  <div>
    <label className="cok-auth-label">
      {label} {required && <span style={{ color: '#E74C3C' }}>&nbsp;*</span>}
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#9CA3AF] z-10">
        {icon}
      </span>
      {children}
    </div>
  </div>
);

interface VisitorFormProps {
  formData: ReservationFormData; loading: boolean; onChange: (d: ReservationFormData) => void; onSubmit: (e: React.FormEvent) => void; onDownloadTemplate: () => void;
  bulkFile: File | null; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onFileRemove: () => void; onBulkUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const VisitorReservationForm: React.FC<VisitorFormProps> = ({ formData, loading, onChange, onSubmit, onDownloadTemplate, bulkFile, onFileSelect, onFileRemove, onBulkUpload, fileInputRef }) => (
  <div className="cok-auth-card overflow-hidden p-5 sm:p-7">
    {/* Login-style centered heading */}
    <div className="text-center mb-5">
      <div className="mx-auto mb-2 w-11 h-11 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
        <FiUser className="w-5 h-5" style={{ color: PRIMARY }} />
      </div>
      <p style={{ fontFamily: fontHeading, fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: PRIMARY, margin: 0 }}>
        Visitor Reservations
      </p>
      <p className="mt-1 text-xs sm:text-sm" style={{ color: '#555555' }}>
        Reserve a parking slot for an expected visitor.
      </p>
    </div>

    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Field label="Full Name" required icon={<FiUser className="h-4 w-4" />}>
          <input type="text" name="driver_name" value={formData.driver_name} onChange={e => onChange({ ...formData, driver_name: e.target.value })} required placeholder="Enter full name" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="Plate Number" required icon={<FiTruck className="h-4 w-4" />}>
          <input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAD 302H" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="Arrival Time" icon={<FiClock className="h-4 w-4" />}>
          <input type="datetime-local" name="arrival_time" value={formData.arrival_time} onChange={e => onChange({ ...formData, arrival_time: e.target.value })} className="cok-auth-input pr-3 py-3" />
        </Field>
        <Field label="Phone Number" icon={<FiPhone className="h-4 w-4" />}>
          <input type="tel" name="telephone_number" value={formData.telephone_number} onChange={e => onChange({ ...formData, telephone_number: e.target.value })} placeholder="+250 791524754" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="ID Type" icon={<FiCreditCard className="h-4 w-4" />}>
          <select name="id_type" value={formData.id_type} onChange={e => onChange({ ...formData, id_type: e.target.value })} className="cok-auth-input pr-3 py-3">
            <option value="NID">National ID</option>
            <option value="Passport">Passport</option>
            <option value="Driving Permit">Driving Permit</option>
          </select>
        </Field>
        <Field label="ID Number" icon={<FiFileText className="h-4 w-4" />}>
          <input type="text" name="id_number" value={formData.id_number} onChange={e => onChange({ ...formData, id_number: e.target.value })} placeholder="Enter ID number" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
      </div>

      {/* Primary action full-width like the login button, template link below it */}
      <button type="submit" disabled={loading} className={`cok-btn-primary flex items-center justify-center gap-2 ${loading ? 'cursor-wait animate-pulse' : 'disabled:opacity-50 disabled:cursor-not-allowed'}`}>
        {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
        <span>Reserve Slot</span>
      </button>
      <button type="button" onClick={onDownloadTemplate} className="cok-btn-outlined w-full flex items-center justify-center gap-2">
        <FiDownload className="h-3.5 w-3.5" />
        Download Template
      </button>
    </form>

    {/* Bulk upload section styled like the login "first time" box */}
    <div className="mt-5">
      <div className="px-3 sm:px-4 py-3 text-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid #E0E0E0' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase" style={{ fontFamily: fontHeading, color: '#333333', letterSpacing: '0.5px' }}>Bulk Visitor Upload</span>
          <span className="text-xs" style={{ color: '#9E9E9E' }}>Excel (.xlsx, .csv)</span>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="visitor-bulk" />
        <label htmlFor="visitor-bulk" className="cursor-pointer block border-2 border-dashed p-4 bg-white" style={{ borderColor: '#E0E0E0' }}>
          <FiUpload className="w-5 h-5 mx-auto mb-1" style={{ color: PRIMARY }} />
          {bulkFile
            ? <span className="flex items-center justify-center gap-2 text-xs"><span style={{ color: '#333333' }}>{bulkFile.name}</span><button type="button" onClick={(e) => { e.preventDefault(); onFileRemove(); }} style={{ color: '#E74C3C' }}><FiX className="w-3.5 h-3.5" /></button></span>
            : <><span className="block text-xs" style={{ color: '#555555' }}>Click to upload</span><span className="block text-xs mt-0.5" style={{ color: '#9E9E9E' }}>.xlsx, .csv</span></>}
        </label>
        {bulkFile && (
          <button onClick={onBulkUpload} disabled={loading} className={`cok-btn-primary mt-2 flex items-center justify-center gap-2 ${loading ? 'cursor-wait animate-pulse' : 'disabled:opacity-50 disabled:cursor-not-allowed'}`}>
            {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiUpload className="h-4 w-4" />}
            <span>Upload List</span>
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
  <div className="cok-auth-card overflow-hidden p-5 sm:p-7">
    {/* Login-style centered heading (dark blue distinguishes staff from visitors) */}
    <div className="text-center mb-5">
      <div className="mx-auto mb-2 w-11 h-11 flex items-center justify-center" style={{ backgroundColor: 'rgba(41,128,185,0.1)' }}>
        <FiBriefcase className="w-5 h-5" style={{ color: ACCENT_DARK_BLUE }} />
      </div>
      <p style={{ fontFamily: fontHeading, fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: ACCENT_DARK_BLUE, margin: 0 }}>
        Permanent Staff Booking
      </p>
      <p className="mt-1 text-xs sm:text-sm" style={{ color: '#555555' }}>
        Allocate a permanent parking slot to a staff member.
      </p>
    </div>

    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Field label="Staff Name" required icon={<FiUser className="h-4 w-4" />}>
          <input type="text" name="staff_name" value={formData.staff_name} onChange={e => onChange({ ...formData, staff_name: e.target.value })} required placeholder="e.g., Amos" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="Plate Number" required icon={<FiTruck className="h-4 w-4" />}>
          <input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAF 100S" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="Phone" icon={<FiPhone className="h-4 w-4" />}>
          <input type="tel" name="phone" value={formData.phone} onChange={e => onChange({ ...formData, phone: e.target.value })} placeholder="+250 791 783 308" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="ID Number" icon={<FiFileText className="h-4 w-4" />}>
          <input type="text" name="identification" value={formData.identification} onChange={e => onChange({ ...formData, identification: e.target.value })} placeholder="National ID Number" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
        <Field label="Department" icon={<FiBriefcase className="h-4 w-4" />}>
          <input type="text" name="department_name" value={formData.department_name} onChange={e => onChange({ ...formData, department_name: e.target.value })} placeholder="e.g., Finance" className="cok-auth-input pr-3 py-3 placeholder:text-gray-400" />
        </Field>
      </div>

      <button type="submit" disabled={loading} className={`cok-btn-primary flex items-center justify-center gap-2 ${loading ? 'cursor-wait animate-pulse' : 'disabled:opacity-50 disabled:cursor-not-allowed'}`}>
        {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiMapPin className="h-4 w-4" />}
        <span>Allocate Slot</span>
      </button>
      <button type="button" onClick={onDownloadTemplate} className="cok-btn-outlined w-full flex items-center justify-center gap-2">
        <FiDownload className="h-3.5 w-3.5" />
        Download Template
      </button>
    </form>

    <div className="mt-5">
      <div className="px-3 sm:px-4 py-3 text-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid #E0E0E0' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase" style={{ fontFamily: fontHeading, color: '#333333', letterSpacing: '0.5px' }}>Staff Directory Sync</span>
          <span className="text-xs" style={{ color: '#9E9E9E' }}>Upload spreadsheet</span>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="staff-bulk" />
        <label htmlFor="staff-bulk" className="cursor-pointer block border-2 border-dashed p-4 bg-white" style={{ borderColor: '#E0E0E0' }}>
          <FiUpload className="w-5 h-5 mx-auto mb-1" style={{ color: ACCENT_DARK_BLUE }} />
          {bulkFile
            ? <span className="flex items-center justify-center gap-2 text-xs"><span style={{ color: '#333333' }}>{bulkFile.name}</span><button type="button" onClick={(e) => { e.preventDefault(); onFileRemove(); }} style={{ color: '#E74C3C' }}><FiX className="w-3.5 h-3.5" /></button></span>
            : <><span className="block text-xs" style={{ color: '#555555' }}>Choose file for staff reservation</span><span className="block text-xs mt-0.5" style={{ color: '#9E9E9E' }}>Excel or CSV format</span></>}
        </label>
        {bulkFile && (
          <button onClick={onBulkUpload} disabled={loading} className={`cok-btn-primary mt-2 flex items-center justify-center gap-2 ${loading ? 'cursor-wait animate-pulse' : 'disabled:opacity-50 disabled:cursor-not-allowed'}`}>
            {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiUpload className="h-4 w-4" />}
            <span>Upload List</span>
          </button>
        )}
      </div>
    </div>
  </div>
);
